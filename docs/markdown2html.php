<?php
require_once('../../parsedown/Parsedown.php');
require_once('../../parsedown/ParsedownExtra.php');

$fname = './'.preg_replace('/[^\w\d-]/','_',$_SERVER["QUERY_STRING"].substr(0,32)).'.md';
if (!file_exists($fname)) { echo 'Not found.'; exit(1); }

$Parsedown = new Parsedown();
echo '<html><head>';
echo '<link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/highlight.js/9.13.1/styles/default.min.css">';
echo '<script src="//cdnjs.cloudflare.com/ajax/libs/highlight.js/9.13.1/highlight.min.js"></script>';
echo '<script>hljs.initHighlightingOnLoad();</script>';
echo <<<JAX
<script type="text/x-mathjax-config">
  MathJax.Hub.Config({
    tex2jax: {
      inlineMath: [ ['$','$'] ],
      processEscapes: true,
      skipTags: ["script","noscript","style","textarea","pre","code"],
    },
    TeX: {
      equationNumbers: { autoNumber: "all" }
    }
  });
</script>
JAX;
echo '<script type="text/javascript" async src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-MML-AM_CHTML"></script>';
echo '</head><body><div style="max-width: 60em; margin: auto;">';
echo $Parsedown->text( file_get_contents($fname) );
echo '</div></body></html>';
?>
