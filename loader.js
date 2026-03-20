// ============================================
// UmimeTo Solver — Console Injection Loader
// ============================================
// Paste this ONE LINE into the browser DevTools
// console on any umimeto.org page to load the solver:
//
// fetch('https://raw.githubusercontent.com/darqsideee/miskavec/main/bundle.js').then(r=>r.text()).then(eval)
//
// ── With custom config (optional) ──
// window.UMIME_CONFIG = { speed: 'normal', autoStart: true };
// fetch('https://raw.githubusercontent.com/darqsideee/miskavec/main/bundle.js').then(r=>r.text()).then(eval)
//
// ── Available speed profiles ──
// 'slow'   — safest against detection, slower responses
// 'normal' — balanced speed (default)
// 'fast'   — fastest, higher detection risk
//
// ── After loading, control via console ──
// solver.start()     — start solving
// solver.stop()      — stop solving
// solver.pause()     — pause
// solver.resume()    — resume
// solver.status()    — check status
//
// ── Change speed on the fly ──
// solver.humanizer.profile = 'slow'
// solver.humanizer.profile = 'fast'
