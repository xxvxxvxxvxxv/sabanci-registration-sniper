"""Optional Telegram delivery; private local configuration, no university credentials."""
import json
import os
import queue
import re
import secrets
import tempfile
import threading
import time
from urllib.request import Request, build_opener
from seats import NoRedirect


def telegram(token,method,payload):
    request=Request('https://api.telegram.org/bot'+token+'/'+method,
                    data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
    try:
        with build_opener(NoRedirect).open(request,timeout=12) as response:
            raw=response.read(1_000_001)
            if len(raw)>1_000_000:raise ValueError('Response too large')
            data=json.loads(raw)
        if not data.get('ok'):raise ValueError('API rejected request')
        return data.get('result')
    except Exception:
        # urllib exception strings contain the credential-bearing URL. Never expose them.
        raise ValueError('Telegram request failed. Check the bot token, network and chat connection.') from None


class Phone:
    def __init__(self,path,transport=telegram):
        self.path=path;self.transport=transport;self.lock=threading.RLock()
        self.config={};self.last='';self.generation=0;self.jobs=queue.Queue(maxsize=25);self.thread=None
        if path.exists():
            try:self.config=json.loads(path.read_text(encoding='utf-8'))
            except (ValueError,OSError):self.last='Phone configuration could not be loaded.'

    def status(self):
        with self.lock:
            return {'configured':bool(self.config.get('token')),'paired':bool(self.config.get('chat_id')),
                    'enabled':self.config.get('enabled',False),'details':self.config.get('details',False),
                    'pair_code':self.config.get('pair_code',''),'last':self.last}

    def save(self):
        fd,name=tempfile.mkstemp(dir=self.path.parent,prefix='.phone-')
        try:
            with os.fdopen(fd,'w',encoding='utf-8') as out:json.dump(self.config,out)
            os.replace(name,self.path)
            os.chmod(self.path,0o600)
        finally:
            if os.path.exists(name):os.unlink(name)

    def connect(self,token):
        if not isinstance(token,str) or not re.fullmatch(r'[0-9]{5,20}:[A-Za-z0-9_-]{20,100}',token):raise ValueError('Enter a valid Telegram bot token.')
        with self.lock:
            self.config={'token':token,'enabled':False,'details':False,'pair_code':'RS-'+secrets.token_hex(4),
                         'pair_expires':time.time()+600}
            self.generation+=1;self.last='Send the pairing command to this bot in a private Telegram chat.';self.save()
        return self.status()

    def pair(self):
        with self.lock:config=dict(self.config);generation=self.generation
        if not config.get('pair_code') or time.time()>config.get('pair_expires',0):raise ValueError('Pairing expired. Save the bot token again.')
        updates=self.transport(config['token'],'getUpdates',{'timeout':0,'limit':100,'allowed_updates':['message']})
        matches={m['chat']['id'] for u in updates if (m:=u.get('message',{})).get('chat',{}).get('type')=='private'
                 and m.get('text','').strip()=='/start '+config['pair_code']}
        if len(matches)!=1:raise ValueError('Send the exact pairing command to the bot, then click Confirm phone.')
        with self.lock:
            if generation!=self.generation:raise ValueError('Phone configuration changed. Try again.')
            self.config['chat_id']=matches.pop();self.config.pop('pair_code',None);self.config.pop('pair_expires',None)
            self.last='Phone paired. Enable delivery to receive future alerts.';self.save()
        return self.status()

    def configure(self,payload):
        if type(payload.get('enabled')) is not bool or type(payload.get('details')) is not bool:raise ValueError('Invalid phone preference.')
        with self.lock:
            if payload['enabled'] and not self.config.get('chat_id'):raise ValueError('Pair the phone first.')
            self.config.update(enabled=payload['enabled'],details=payload['details']);self.generation+=1;self.save()
        return self.status()

    def enqueue(self,event):
        with self.lock:
            if not self.config.get('enabled'):return
            text='Registration Sniper: monitoring stopped. Open the local app.' if event['kind']=='stopped' else 'Registration Sniper: a seat opened. Open the local app.'
            if self.config.get('details') and event['kind']=='opened':text+=f" Term {event['term']}, CRN {event['crn']}, observed seats: {event['remaining']}."
            try:self.jobs.put_nowait((dict(self.config),self.generation,text))
            except queue.Full:self.last='Phone delivery queue full; check Recent alerts in the app.';return
            if self.thread is None:
                self.thread=threading.Thread(target=self.worker,daemon=True,name='phone-alerts');self.thread.start()

    def worker(self):
        while True:
            config,generation,text=self.jobs.get()
            with self.lock:valid=generation==self.generation and self.config.get('enabled')
            if valid:
                try:
                    self.transport(config['token'],'sendMessage',{'chat_id':config['chat_id'],'text':text})
                    with self.lock:self.last='Last alert accepted by Telegram.'
                except ValueError:
                    with self.lock:self.last='Phone delivery failed. Alert remains in the local log; no automatic resend.'
            self.jobs.task_done()

    def test(self):
        with self.lock:config=dict(self.config)
        if not config.get('chat_id'):raise ValueError('Pair the phone first.')
        self.transport(config['token'],'sendMessage',{'chat_id':config['chat_id'],'text':'Registration Sniper: phone notification test.'})
        with self.lock:self.last='Test accepted by Telegram. Check the phone.'
        return self.status()

    def disconnect(self):
        with self.lock:
            self.config={};self.generation+=1;self.last='Phone disconnected.'
            if self.path.exists():self.path.unlink()
        return self.status()
