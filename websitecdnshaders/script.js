// London Clock
function updateLondonClock() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const timeStr = formatter.format(now);

  const navDisplay = document.getElementById('londonTimeDisplay');
  const mobileDisplay = document.getElementById('mobileLondonTime');

  if (navDisplay) navDisplay.textContent = timeStr;
  if (mobileDisplay) mobileDisplay.textContent = timeStr + ' in London';
}

updateLondonClock();
setInterval(updateLondonClock, 1000);

// Mobile Menu Toggle
const menuBtn = document.getElementById('mobileMenuBtn');
const overlay = document.getElementById('mobileOverlay');
const menuIcon = document.getElementById('menuIcon');
let menuOpen = false;

function toggleMenu() {
  menuOpen = !menuOpen;
  overlay.classList.toggle('active', menuOpen);
  document.body.style.overflow = menuOpen ? 'hidden' : '';

  if (menuOpen) {
    menuIcon.innerHTML =
      '<line x1="18" y1="6" x2="6" y2="18"/>' +
      '<line x1="6" y1="6" x2="18" y2="18"/>';
  } else {
    menuIcon.innerHTML =
      '<line x1="4" y1="12" x2="20" y2="12"/>' +
      '<line x1="4" y1="6" x2="20" y2="6"/>' +
      '<line x1="4" y1="18" x2="20" y2="18"/>';
  }
}

menuBtn.addEventListener('click', toggleMenu);
overlay.addEventListener('click', function(e) {
  if (e.target === overlay) toggleMenu();
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && menuOpen) toggleMenu();
});

// ====== Shaders library from CDN ======
(async function initShader() {
  const canvas = document.getElementById('shaderCanvas');
  if (!canvas) return;

  try {
    const { createShader } = await import('https://esm.sh/shaders@latest/js');

    await createShader(canvas, {
      components: [
        {
          type: 'Swirl',
          props: {
            colorA: '#ffffff',
            colorB: '#f0f0f0',
            detail: 1.7
          }
        },
        {
          type: 'ChromaFlow',
          props: {
            baseColor: '#ffffff',
            downColor: '#ff5f03',
            leftColor: '#ff5f03',
            rightColor: '#ff5f03',
            upColor: '#ff5f03',
            momentum: 13,
            radius: 3.5
          }
        },
        {
          type: 'FlutedGlass',
          props: {
            aberration: 0.61,
            angle: 31,
            frequency: 8,
            highlight: 0.12,
            highlightSoftness: 0,
            lightAngle: -90,
            refraction: 4,
            shape: 'rounded',
            softness: 1,
            speed: 0.15
          }
        },
        {
          type: 'FilmGrain',
          props: {
            strength: 0.05
          }
        }
      ]
    });
  } catch (err) {
    console.warn('Shaders CDN import failed, using custom WebGL fallback.', err);

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vertexSrc = `attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}`;
    const fragmentSrc = `
      precision highp float;
      uniform float t; uniform vec2 r;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      void main(){
        vec2 u=gl_FragCoord.xy/r;vec2 c=u-.5;float d=length(c),a=atan(c.y,c.x);
        float sw=sin(a*1.7+d*3.-t*.25)*.5+.5;
        float f1=sin((u.x*8.-t*.2)+u.y*2.)*.5+.5,f2=sin((u.x*5.-t*.15)-u.y*3.)*.5+.5,fl=f1*.6+f2*.4;
        vec3 o=vec3(1,.373,.012),ch=o*fl*.15;
        float gs=sin(u.x*8.+u.y*3.+t*.08)*.5+.5,hl=smoothstep(.4,.6,gs)*.08,re=sin(u.x*4.-u.y*2.+t*.05)*.02;
        float gr=mix(1.,h(floor(u*200.)),.05);
        vec3 bg=vec3(.937);gl_FragColor=vec4((bg+ch+hl+re)*gr,1);
      }
    `;
    function cs(s,t_){const sh=gl.createShader(t_);gl.shaderSource(sh,s);gl.compileShader(sh);return sh;}
    const vs=cs(vertexSrc,gl.VERTEX_SHADER),fs=cs(fragmentSrc,gl.FRAGMENT_SHADER),p=gl.createProgram();
    gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.useProgram(p);
    const pl=gl.getAttribLocation(p,'p'),tl=gl.getUniformLocation(p,'t'),rl=gl.getUniformLocation(p,'r');
    const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(pl);gl.vertexAttribPointer(pl,2,gl.FLOAT,false,0,0);
    function rs(){const w=canvas.parentElement.clientWidth,h=canvas.parentElement.clientHeight;canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);gl.uniform2f(rl,w,h);}
    rs();window.addEventListener('resize',rs);
    let s=performance.now();
    function rd(){gl.uniform1f(tl,(performance.now()-s)/1000);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);requestAnimationFrame(rd);}
    rd();
  }
})();