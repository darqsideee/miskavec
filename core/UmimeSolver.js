// ============================================
// UmimeSolver — Main Orchestrator
// Initializes all sub-systems, detects games,
// activates modules, and runs the solving loop.
// ============================================
class UmimeSolver {

    /**
     * @param {Object} config
     * @param {'slow'|'normal'|'fast'} config.speed - Speed profile
     * @param {boolean} config.autoStart - Auto-start on load
     * @param {string[]} config.enabledModules - Which modules to enable
     */
    constructor(config = {}) {
        this.config = {
            speed: config.speed || 'normal',
            autoStart: config.autoStart !== false,
            enabledModules: config.enabledModules || ['textInput', 'choice', 'pexeso', 'dragDrop'],
            maxRetries: config.maxRetries || 3,
            loopDelay: config.loopDelay || [1500, 3500], // [min, max] ms between actions
            ...config
        };

        // Core systems
        this.humanizer = new Humanizer(this.config.speed);
        this.stateManager = new StateManager();
        this.domWatcher = new DOMWatcher();

        // Game modules
        this.modules = {};
        this._initModules();

        // State
        this._running = false;
        this._loopHandle = null;
        this._retryCount = 0;
        this._currentModule = null;

        // Banner
        this._printBanner();

        // Auto-start if configured
        if (this.config.autoStart) {
            this.start();
        }
    }

    /**
     * Initialize all game modules.
     */
    _initModules() {
        const moduleMap = {
            textInput: TextInputModule,
            choice: ChoiceModule,
            pexeso: PexesoModule,
            dragDrop: DragDropModule
        };

        for (const [key, ModuleClass] of Object.entries(moduleMap)) {
            if (this.config.enabledModules.includes(key)) {
                this.modules[key] = new ModuleClass(this.humanizer, this.stateManager);
            }
        }

        console.log(
            `%c[UmimeSolver] 📦 Loaded modules: ${Object.keys(this.modules).join(', ')}`,
            'color: #9C27B0'
        );
    }

    // ── Lifecycle ─────────────────────────────────

    /**
     * Start the solver.
     */
    start() {
        if (this._running) {
            console.warn('[UmimeSolver] Already running!');
            return;
        }

        this._running = true;
        this.stateManager.start((elapsed) => this._onStuck(elapsed));
        this.domWatcher.start();

        // Listen for DOM changes
        this.domWatcher.on('questionChanged', () => {
            this._retryCount = 0;
            this.stateManager.recordActivity();
        });

        this.domWatcher.on('scoreUpdate', (data) => {
            if (data.correct) {
                this.stateManager.recordCorrect();
            } else {
                this.stateManager.recordWrong();
            }
        });

        console.log(
            `%c[UmimeSolver] ▶️ Started! Speed: ${this.config.speed}`,
            'color: #4CAF50; font-weight: bold; font-size: 14px'
        );

        // Start the main loop
        this._runLoop();
    }

    /**
     * Stop the solver.
     */
    stop() {
        this._running = false;
        this.stateManager.stop();
        this.domWatcher.stop();

        if (this._loopHandle) {
            clearTimeout(this._loopHandle);
            this._loopHandle = null;
        }

        // Deactivate current module
        if (this._currentModule) {
            this._currentModule.deactivate();
            this._currentModule = null;
        }

        const summary = this.stateManager.getSummary();
        console.log(
            `%c[UmimeSolver] ⏹ Stopped. Final score: ${summary.correct}/${summary.totalQuestions} (${summary.accuracy}%)`,
            'color: #f44336; font-weight: bold; font-size: 14px'
        );
    }

    /**
     * Pause the solver.
     */
    pause() {
        this.stateManager.state.isPaused = true;
        console.log('%c[UmimeSolver] ⏸ Paused', 'color: #FF9800; font-weight: bold');
    }

    /**
     * Resume the solver.
     */
    resume() {
        this.stateManager.state.isPaused = false;
        this.stateManager.recordActivity();
        console.log('%c[UmimeSolver] ▶️ Resumed', 'color: #4CAF50; font-weight: bold');
    }

    /**
     * Get current status.
     */
    status() {
        const summary = this.stateManager.getSummary();
        const moduleStates = {};
        for (const [key, mod] of Object.entries(this.modules)) {
            moduleStates[key] = mod.getState();
        }
        return {
            running: this._running,
            paused: this.stateManager.state.isPaused,
            ...summary,
            currentModule: this._currentModule?.name || 'none',
            modules: moduleStates
        };
    }

    // ── Main Loop ─────────────────────────────────

    async _runLoop() {
        if (!this._running) return;
        if (this.stateManager.state.isPaused) {
            this._loopHandle = setTimeout(() => this._runLoop(), 1000);
            return;
        }

        try {
            // 1. Identify game type
            const gameType = GameRouter.identifyGameType();

            if (gameType) {
                // 2. Find and activate the matching module
                const module = this.modules[gameType.type];

                if (module) {
                    // Switch module if needed
                    if (this._currentModule !== module) {
                        if (this._currentModule) this._currentModule.deactivate();
                        module.activate();
                        this._currentModule = module;
                    }

                    // 3. Check if module can handle current state
                    if (module.canHandle()) {
                        const success = await module.solve();

                        if (success) {
                            this._retryCount = 0;
                            // Wait for potential feedback / next question transition
                            await this.humanizer.afterAction();

                            // Try clicking "next" if available
                            await module._clickNext();
                        } else {
                            this._retryCount++;
                            console.warn(`[UmimeSolver] Solve failed (retry ${this._retryCount}/${this.config.maxRetries})`);
                        }
                    } else {
                        // Module can't handle current state — might be a transition
                        await this.humanizer.wait(500, 1000);
                    }
                } else {
                    console.warn(`[UmimeSolver] No module available for game type: ${gameType.type}`);
                }
            } else {
                // No game detected — wait and retry
                await this.humanizer.wait(1000, 2000);
            }

        } catch (error) {
            this.stateManager.logError(error, 'mainLoop');
            this._retryCount++;
        }

        // Check retry limit
        if (this._retryCount >= this.config.maxRetries) {
            console.warn(
                `%c[UmimeSolver] ⚠️ Max retries reached. Waiting before next attempt...`,
                'color: #FF9800'
            );
            await this.humanizer.wait(3000, 5000);
            this._retryCount = 0;
        }

        // Schedule next loop iteration
        const [loopMin, loopMax] = this.config.loopDelay;
        const delay = loopMin + Math.random() * (loopMax - loopMin);
        this._loopHandle = setTimeout(() => this._runLoop(), delay);
    }

    // ── Recovery ──────────────────────────────────

    _onStuck(elapsed) {
        console.warn(
            `%c[UmimeSolver] 🔄 Stuck recovery triggered (${Math.round(elapsed / 1000)}s idle)`,
            'color: #FF9800; font-weight: bold'
        );

        // Strategy 1: Try clicking "next" or "continue"
        if (this._currentModule) {
            this._currentModule._clickNext().then(clicked => {
                if (clicked) {
                    console.log('[UmimeSolver] Recovery: clicked next button');
                    this.stateManager.recordActivity();
                } else {
                    // Strategy 2: Switch to manual mode after repeated stucks
                    if (this.stateManager.state.errors.length >= 5) {
                        this.stateManager.toManual();
                        this.pause();
                    }
                }
            });
        }

        this.stateManager.recordActivity(); // Reset timer
    }

    // ── Banner ────────────────────────────────────

    _printBanner() {
        console.log(`
%c╔══════════════════════════════════════════╗
║          🎓 UmimeTo Solver v1.0         ║
║       github.com/darqsideee/miskavec    ║
╠══════════════════════════════════════════╣
║  Speed: ${this.config.speed.padEnd(8)}                        ║
║  Modules: ${Object.keys(this.modules).length}                            ║
║                                          ║
║  Commands:                               ║
║    solver.start()   - Start solving      ║
║    solver.stop()    - Stop solving       ║
║    solver.pause()   - Pause              ║
║    solver.resume()  - Resume             ║
║    solver.status()  - Check status       ║
╚══════════════════════════════════════════╝`,
            'color: #2196F3; font-family: monospace; font-size: 12px'
        );
    }
}

// ── Global Entry Point ──────────────────────────
// Expose to window for console access
(function () {
    // Default config (can be overridden via window.UMIME_CONFIG before loading)
    const config = window.UMIME_CONFIG || {
        speed: 'normal',
        autoStart: true,
        enabledModules: ['textInput', 'choice', 'pexeso', 'dragDrop']
    };

    // Create global solver instance
    window.solver = new UmimeSolver(config);

    // Convenience aliases
    window.umime = window.solver;
})();
