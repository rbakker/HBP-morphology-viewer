/*
This file is part of the HBP Morphology Viewer.

HBP Morphology Viewer is free software: you can redistribute it and/or
modify it under the terms of the GNU General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

HBP Morphology Viewer is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the 
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with HBP Morphology Viewer.  
If not, see <http://www.gnu.org/licenses/>
*/

/*
 * moviInterface opens a new Morphology Viewer window,
 * and waits for the user to send commands to it.
 * When the window is closed or popup-blocked, it asks the user
 * permission to reopen it.
 * 
 * eventHandler is a function called when messages are received from 
 * the Morphology Viewer that are not in response to a request.
 * 
 * channelName is the broadcast channel that thE interface listens to.
 * This is only needed to communicate with certain Jupyter environments, 
 * in particular Google Colabs.
 * 
 */
 
import { rpcInterface_class } from "./rpc-interface.js";

export function moviInterface_class(appUrl,eventHandler,channelName) {
  rpcInterface_class.apply(this,[appUrl,'Morphology Viewer',eventHandler,channelName]);
}

moviInterface_class.prototype = new rpcInterface_class();

moviInterface_class.prototype.send = async function(/* arguments */) {
  const command = arguments[0];
  const method_lc = command.method && String(command.method).toLowerCase();
  const params = command.params;
  if (method_lc && params && method_lc.substr(0,5) === 'movi.' && params.contents === undefined && params.url) {
    // special case: fetch contents instead of sending url to avoid CORS issues
    console.log('Fetching URL');
    let contents = await fetch(params.url);
    contents = await contents.arrayBuffer();
    params.name = params.name || params.url;
    params.contents = contents;
  }
  return rpcInterface_class.prototype.send.apply(this,arguments);
}
