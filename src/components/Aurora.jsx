import { useEffect, useRef } from 'react'

// Flowing lime/teal "aurora" behind the hero, drawn by a small WebGL shader.
// Pauses off-screen and in hidden tabs, renders one still frame for reduced-motion users,
// renders at reduced resolution (it's blurry by nature), and falls back to CSS if WebGL is missing.

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y);
  float t = uTime * 0.045;

  // domain-warped noise = slow, curtain-like flow
  vec2 q = vec2(fbm(p * 1.4 + vec2(0.0, t)), fbm(p * 1.4 + vec2(5.2, -t * 0.8)));
  vec2 m = (uMouse - 0.5) * 0.35;
  float n = fbm(p * 1.8 + 2.6 * q + m + vec2(t * 0.6, -t * 0.3));

  // two curtains of light sweeping across the upper half, with fine vertical rays
  float rays = 0.55 + 0.45 * fbm(vec2(p.x * 7.0 + q.x * 2.0, t * 2.0));
  float y1 = 0.60 + 0.16 * (n - 0.5) + 0.07 * sin(p.x * 1.6 + t * 3.0);
  float y2 = 0.80 + 0.20 * (q.x - 0.5) + 0.05 * sin(p.x * 2.2 - t * 2.4);
  float band1 = smoothstep(0.26, 0.0, abs(uv.y - y1)) * smoothstep(-0.05, 0.10, uv.y - y1 + 0.18);
  float band2 = smoothstep(0.18, 0.0, abs(uv.y - y2));

  vec3 ink  = vec3(0.039, 0.047, 0.063);                                  // page background #0A0C10
  vec3 lime = vec3(0.714, 0.953, 0.416);
  vec3 teal = vec3(0.176, 0.831, 0.749);
  vec3 col = ink;
  col += lime * band1 * rays * (0.35 + 0.65 * n) * 0.40;
  col += teal * band2 * rays * (0.35 + 0.65 * q.y) * 0.50;
  col += mix(teal, lime, uv.x) * 0.035 * smoothstep(0.3, 1.0, n);      // faint overall glow

  col = mix(ink, col, smoothstep(0.05, 0.50, uv.y));                    // fade into the page colour below (no dark seam)
  gl_FragColor = vec4(col, 1.0);
}`

export default function Aurora({ className = '' }) {
  const canvasRef = useRef(null)
  const fallbackRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas && canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) { if (fallbackRef.current) fallbackRef.current.style.display = 'block'; canvas && (canvas.style.display = 'none'); return }

    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s }
    const prog = gl.createProgram()
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { if (fallbackRef.current) fallbackRef.current.style.display = 'block'; canvas.style.display = 'none'; return }
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const uRes = gl.getUniformLocation(prog, 'uRes'), uTime = gl.getUniformLocation(prog, 'uTime'), uMouse = gl.getUniformLocation(prog, 'uMouse')

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const small = window.matchMedia('(max-width: 640px)').matches
    const scale = (small ? 0.35 : 0.5) * Math.min(window.devicePixelRatio || 1, 1.5)   // soft image, so render small and let CSS upscale
    let mouse = [0.5, 0.5], target = [0.5, 0.5]

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(r.width * scale)); canvas.height = Math.max(1, Math.round(r.height * scale))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(canvas)

    const onMove = e => { const r = canvas.getBoundingClientRect(); target = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height] }
    window.addEventListener('pointermove', onMove, { passive: true })

    let raf = 0, visible = true, start = performance.now()
    const frame = now => {
      mouse = [mouse[0] + (target[0] - mouse[0]) * 0.03, mouse[1] + (target[1] - mouse[1]) * 0.03]
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, reduce ? 12.0 : (now - start) / 1000 + 12.0)
      gl.uniform2f(uMouse, mouse[0], mouse[1])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(frame)
    }
    const play = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame) }
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) play() })
    io.observe(canvas)
    const onVis = () => { if (!document.hidden) play() }
    document.addEventListener('visibilitychange', onVis)
    play()

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
      window.removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="h-full w-full" />
      {/* CSS fallback when WebGL is unavailable */}
      <div
        ref={fallbackRef}
        className="absolute inset-0 hidden"
        style={{ background: 'radial-gradient(60% 50% at 30% 20%, rgba(182,243,106,.16), transparent 70%), radial-gradient(50% 40% at 75% 10%, rgba(45,212,191,.14), transparent 70%)' }}
      />
    </div>
  )
}
