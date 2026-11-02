(function () {
  var canvas = document.getElementById('shaderCanvas');
  if (!canvas) return;

  var parent = canvas.parentElement;
  if (parent) parent.style.backgroundColor = '#EFEFEF';

  var gl;
  try {
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  } catch (e) {}

  if (gl) {
    runWebGL(gl, canvas);
  } else {
    cssFallback(parent);
  }

  function runWebGL(gl, canvas) {
    var vertexSrc = 'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}';
    var fragmentSrc = [
      'precision mediump float;',
      'uniform float t;uniform vec2 r;',
      'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
      'void main(){',
      'vec2 u=gl_FragCoord.xy/r;vec2 c=u-.5;float d=length(c),a=atan(c.y,c.x);',
      'float sw=sin(a*1.7+d*3.-t*.25)*.5+.5;',
      'float f1=sin(u.x*8.-t*.2+u.y*2.)*.5+.5;',
      'float f2=sin(u.x*5.-t*.15-u.y*3.)*.5+.5;',
      'float fl=f1*.6+f2*.4;',
      'vec3 o=vec3(1.,.373,.012);vec3 ch=o*fl*.15;',
      'float gs=sin(u.x*8.+u.y*3.+t*.08)*.5+.5;',
      'float hl=smoothstep(.4,.6,gs)*.08;',
      'float re=sin(u.x*4.-u.y*2.+t*.05)*.02;',
      'float gr=mix(1.,h(floor(u*200.)),.05);',
      'vec3 bg=vec3(.937);',
      'gl_FragColor=vec4((bg+ch+hl+re)*gr,1.);',
      '}'
    ].join('\n');

    function makeShader(src, type) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('Shader compile error:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    var vs = makeShader(vertexSrc, gl.VERTEX_SHADER);
    var fs = makeShader(fragmentSrc, gl.FRAGMENT_SHADER);
    if (!vs || !fs) { cssFallback(parent); return; }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('Shader link error');
      cssFallback(parent);
      return;
    }
    gl.useProgram(prog);

    var posLoc = gl.getAttribLocation(prog, 'p');
    var timeLoc = gl.getUniformLocation(prog, 't');
    var resLoc = gl.getUniformLocation(prog, 'r');

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    function resize() {
      var w = canvas.parentElement.clientWidth;
      var h = canvas.parentElement.clientHeight;
      if (w < 1) w = window.innerWidth;
      if (h < 1) h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(resLoc, w, h);
    }

    resize();
    window.addEventListener('resize', resize);

    var start = performance.now();

    function draw() {
      gl.uniform1f(timeLoc, (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(draw);
    }
    draw();
  }

  function cssFallback(parent) {
    if (!parent) return;
    parent.style.background =
      'radial-gradient(ellipse at 30% 50%, rgba(242,101,34,0.06) 0%, transparent 60%), ' +
      'radial-gradient(ellipse at 70% 50%, rgba(242,101,34,0.04) 0%, transparent 60%), ' +
      '#EFEFEF';

    if (!document.getElementById('shader-fallback-style')) {
      var style = document.createElement('style');
      style.id = 'shader-fallback-style';
      style.textContent =
        '@keyframes shaderDrift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}';
      document.head.appendChild(style);
    }
    parent.style.backgroundSize = '200% 200%';
    parent.style.animation = 'shaderDrift 12s ease infinite';
  }
})();
