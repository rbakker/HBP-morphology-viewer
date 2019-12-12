<style>
a.tryme { display: inline-block; background: #0F0; padding: 0.5em; margin: 0.5em 0em; border: 0.2em outset grey; border-radius: 0.5em; font-size: 120%; text-decoration: none }
a.tryme:hover { text-decoration: underline }
</style>

See also: <a href="markdown2html.php?jupyter">Controlling HBP Morphology Viewer from a Jupyter notebook</a>

# Exchanging data with HBP Morphology Viewer

If you are a website builder or Jupyter notebook user, you can use the HBP Morphology Viewer 
as a front end to display data in a secure and private way, or to convert neuron morphologies between the formats that the viewer supports. The mechanism for this is that you load a small library that opens HBP Morphology Viewer in a new tab from within your web application or notebook. This instance of HBP Morphology Viewer will be listening 
for incoming messages. Your website can send a command, and HBP Morphology Viewer will carry it out and display the result or return a response. The data-exchange mechanism is such that no data gets sent to the HBP Morphology Viewer server; all communication takes place in the browser on the client's computer. Therefore, the method is safe to use for privacy-sensitive data.

Impatient? <a class="tryme" target="_blank" href="tryme.php?exchangedata-import-url">See how it works</a>

Two commands are currently supported:

- `MoVi.import` for importing a data file into HBP Morphology Viewer. In principle, any file that you can load manually with the "Local drive: Choose Files" button can be displayed in this way. The 'see how it works'-example above demonstrates this command.
- `MoVi.convert` for converting a neuron between supported file formats: SWC+, Neurolucida (DAT,ASC,XML,NRX) and MoVi's internal JSON-based format. With this command you can send a neuron in one format, and wait for the response that contains the neuron in another format.

Internally, commands to HBP Morphology Viewer are sent according to the <a href="https://www.jsonrpc.org/specification" target="_blank">json-rpc 2.0 protocol</a>.
This means that each command message is a JSON structure with fields `id` (message-id), `method` (one of the supported commands), `params` (command parameters), and that HBP Morphology Viewer responds with a JSON structure that specifies the `result` or `error`.
In this tutorial we give examples on how to use each of the above commands.

The first step for each example is to open HBP Morphology Viewer in a new window/tab. Managing multiple tabs is tricky, and we provide a Javascript module  
<a href="../js/movi-interface.mjs" target="_blank">movi-interface.mjs</a> that takes care of the details: 
- It verifies that the HBP Morphology window is available.
- It takes care of sending commands in JSON-RPC 2.0 format.
- It verifies that each command is received by HBP Morphology Viewer.

You find the library in the `/js` folder of the Morphology Viewer website:
```
<script type="text/javascript" src="https://neuroinformatics.nl/HBP/morphology-viewer/js/movi-interface.mjs"></script>
```

In the examples, we create a button with an onclick field that calls the function `onclickHandler`.
This function needs just two lines of code to invoke HBP Morphology Viewer:
```javascript
var moviInterface;

function onclickHandler() {
  // define moviUrl here, it contains the address of the Morphology Viewer page that you want to load,
  // such as `https://neuroinformatics.nl/HBP/morphology-viewer`
  (...)
  
  // reuse moviInterface if it exists
  moviInterface = moviInterface || new moviInterface_class(moviUrl);
  
  // define sbaCommand here
  (...)
  
  moviInterface.send(sbaCommand);
}
```
Calling `new moviInterface_class(moviUrl)` opens a new HBP Morphology Viewer window. Under some circumstances, this may trigger the browser's popup blocker. This is not a problem. As soon as you use `moviInterface.send(...)`, the user will be prompted to re-open HBP Morphology Viewer, and this time the popup blocker will not kick in since the opening of the new window is a direct consequence of user interaction. 
To bypass the popup blocker completely, make sure to place `new moviInterface_class` inside an event handler that responds to a mouse click or key press.

Once `moviInterface` has been created, keep it in memory so that it can be used to send multiple messages to HBP Morphology Viewer.

### Using the `MoVi.import` command

The arguments that come with this command are:
- `name`: the name of the imported file.
- `mime`: the mime-type of the imported file. This can be one of:
  - application/vnd.hbp.movi+json (Morphology Viewer's internal JSON format)
  - model/swc (SWC format)
  - model/mbf.asc (Neurolucida .ASC format)
  - model/mbf.dat (Neurolucida .DAT format)
  - model/mbf.nrx (Neurolucida .NRX format)
  - model/mbf.xml (Neurolucida .XML format)
  - or any of the above with `+gzip` appended, if the data is gzipped.
  If omitted, will be derived from the file extension of `name`.
- either `contents` or `url`: the contents/url of the imported file.

Working with the Url of the file to import into the viewer is easiest. This is used by the 'see how it works' example above. The Url must be on the same domain as the user's website, or point to a website that is specifically configured for <a href="https://en.wikipedia.org/wiki/Cross-origin_resource_sharing">cross-origin requests</a>. The following example is more complex, because it first loads the contents of the file into the user's webpage and then sends the result to the Morphology Viewer. This mechanism can be useful for data that does not have a public url.

Try it yourself: <a class="tryme" target="_blank" href="tryme.php?exchangedata-import">Import file into the viewer example</a>

### Using the `MoVi.convert` command

The arguments that come with this command are:
- all the arguments that apply to the `MoVi.import` command.
- `toMime`: The mime-type of that the data needs to be converted to. For valid options, see the `mime` argument oif the `MoVi.import` command.
- `toName`: In addition to/Instead of the mime-type of the output file, you may also specify its name. The mime type will be derived from the file extension.
- `doRender`: Whether or not to render the output neuron in the viewer. Default: `false`.

The following converts a file from SWC to Neurolucida XML, and then displays it in the Morphology Viewer:
```
moviCommand = {
  "method": "MoVi.convert",
  "params": {
    "name": "../samples/",
    "toMime": "model/mbf.xml+gzip",
    "doRender": true
  }
}
```
The converted neuron is returned by the `send` command by means of a <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises">Javascript Promise</a>, to which you can assign an action to carry out when the Promise gets fulfilled.

Try it yourself: <a class="tryme" target="_blank" href="tryme.php?exchangedata-convert">Convert SWC to XML example</a>
