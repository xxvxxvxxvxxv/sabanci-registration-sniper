'use strict';
chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>console.warn('Could not enable the side panel.'));
