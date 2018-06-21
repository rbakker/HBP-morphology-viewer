/*adapted from https://github.com/argunner/minAjax.js/blob/master/minify/index.min.js*/
function xhr_init(){return window.XMLHttpRequest?new XMLHttpRequest:new ActiveXObject("Microsoft.XMLHTTP")}
function xhr_headers(h,o,rt){o.responseType=rt?rt:'text';for(k in h)o.setRequestHeader(k,h[k])}
function ajaxRequest(e){
  if(!e.url)return void(1==e.debugLog&&console.log("No Url!"))
  if(!e.type)return void(1==e.debugLog&&console.log("No type (GET/POST) given!"))
  e.method||(e.method=!0),e.debugLog||(e.debugLog=!1)
  var o=xhr_init()
  o.onreadystatechange=function(){
    if(4==o.readyState)200==o.status?(e.success&&e.success(o),1==e.debugLog&&console.log("SuccessResponse"),1==e.debugLog&&console.log("Response Data:"+o.responseText)):e.fail&&e.fail(o),1==e.debugLog&&console.log("FailureResponse --> State:"+o.readyState+"Status:"+o.status)
  }
  var t=[],n=e.data,q=e.url
  if("string"==typeof n)for(var s=String.prototype.split.call(n,"&"),r=0,a=s.length;a>r;r++){
    var c=s[r].split("=");t.push(encodeURIComponent(c[0])+"="+encodeURIComponent(c[1]))
  }else if("object"==typeof n&&!(n instanceof String||FormData&&n instanceof FormData))for(var p in n){
    var c=n[p]
    if("[object Array]"==Object.prototype.toString.call(c))for(var r=0,a=c.length;a>r;r++)t.push(encodeURIComponent(p)+"[]="+encodeURIComponent(c[r]))
    else t.push(encodeURIComponent(p)+"="+encodeURIComponent(c))
  }
  t=t.join("&"),h=e.headers||(h=[])
  "GET"==e.type&&(o.requestUrl=q=q+"?"+t,o.open("GET",q,e.method),xhr_headers(h,o,e.responseType),o.send(),1==e.debugLog&&console.log("GET fired at:"+q))
  "POST"==e.type&&(o.open("POST",o.requestUrl=q,e.method),xhr_headers(h.push("Content-type","application/x-www-form-urlencoded"),o,e.responseType),o.send(t),1==e.debugLog&&console.log("POST fired at:"+q+" || Data:"+t))
}