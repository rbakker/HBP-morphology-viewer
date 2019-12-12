<?php
$fname = './'.preg_replace('/[^\w\d-]/','_',$_SERVER["QUERY_STRING"]).substr(0,32).'.html';
if (!file_exists($fname)) { echo 'Not found.'; exit(1); }

?>
<!DOCTYPE html>
<html>
<head>
<style type="text/css">
html,body { margin:0; padding:0; height:100%; width:100%; overflow: hidden;}

#container {
  display: table;
  border-collapse: collapse;
  border: 0px;
  height:100%;
	width:100%;
  white-space : nowrap; 
  overflow : hidden;
  position:relative;
}

#title {
  display:table-row;
  height: 1px;
  border-bottom: 2px solid #FFAA00;
}

#content {
  display:table-row;
  height:100%;
}

#editor {
	display:table-cell;
  height: 100%;
  width:50%;
}

#editor-title {
	display:table-cell;
  box-sizing: border-box;
	width:50%;
  font-size: 24pt;
  color: black;
  background: #ddd;
  padding: 1ex;
}

#iframe {
	display:table-cell;
	height:100%;
	width:100%;
}

#iframe-title {
	display:table-cell;
  box-sizing: border-box;
	width:50%;
  font-size: 24pt;
  color: white;
  background: #888;
  padding: 1ex;
}

/* disable tag matching */
.ace_editor .ace_marker-layer .ace_bracket { display: none }
</style>

<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.1/ace.js"></script>
<script type="text/javascript">
function update()
{
	var idoc = document.getElementById('iframe').contentWindow.document;

	idoc.open();
	try { idoc.write(editor.getValue()); }
  catch(msg) {}
	idoc.close();
}

function setupEditor()
{
  window.editor = ace.edit("editor");
  editor.setTheme("ace/theme/tomorrow_night");
  editor.getSession().setMode("ace/mode/html");
  editor.setValue(<?php echo json_encode(file_get_contents($fname)); ?>,1); //1 = moves cursor to end

  editor.getSession().on('change', function() {
    update();
  });

  editor.focus();
  
  editor.setOptions({
    fontSize: "16pt",
    showLineNumbers: false,
    showGutter: false,
    vScrollBarAlwaysVisible:true
  });

  editor.setShowPrintMargin(false);
  editor.setBehavioursEnabled(false);
}
</script>
</head>

<body onload="setupEditor(); update()">
<div id="container">
  <div id="title">
    <div id="editor-title">
      Code Editor
    </div>
    <div id="iframe-title">
      Live Website Preview
    </div>
  </div>
  <div id="content">
    <div id="editor">
    </div>
    <iframe id="iframe" frameBorder="0">
    </iframe>
  </div>
</div>
</body>

</html>

