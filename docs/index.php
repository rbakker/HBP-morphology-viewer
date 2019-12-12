<html>
<h1>SBA Composer Documentation and Tutorials </h1>

<ul>
<?php
$files = glob("*.md");
foreach ($files as $fname) {
  $fp = fopen($fname, 'rt');
  $noext = substr($fname,0,-3);
  while(!feof($fp)) {
    $line = fgets($fp);
    if ($line[0] == '#') {
      echo '<li>';
      echo trim(substr($line,1));
      echo '<br/><a href="markdown2html.php?'.$noext.'">'.$noext.'</a>';
      echo '</li>';
      break;
    }
  }
  fclose($fp);
}
?>
</ul>
</html>