import {env} from 'cloudflare:workers';
export function db(){if(!env.DB)throw Error('Public feed storage unavailable.');return env.DB;}
