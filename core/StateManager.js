// ============================================
// StateManager — Score tracking, stuck detection
// ============================================
class StateManager {

    constructor() {
        this.state = {
            totalQuestions: 0,
            correct: 0,
            wrong: 0,
            streak: 0,
            lastActivityTime: Date.now(),
            isRunning: false,
            isPaused: false,
            currentModule: null,
            mode: 'auto', // 'auto' | 'manual'
            errors: []
        };

        this._stuckCheckInterval = null;
        this._stuckThreshold = 15000; // 15 seconds
        this._onStuck = null;
    }

    /**
     * Start the state manager with stuck detection.
     * @param {Function} onStuck - Callback when stuck detected
     */
    start(onStuck) {
        this.state.isRunning = true;
        this.state.lastActivityTime = Date.now();
        this._onStuck = onStuck;

        this._stuckCheckInterval = setInterval(() => {
            this._checkStuck();
        }, 3000);
    }

    stop() {
        this.state.isRunning = false;
        if (this._stuckCheckInterval) {
            clearInterval(this._stuckCheckInterval);
            this._stuckCheckInterval = null;
        }
    }

    /**
     * Record activity (resets stuck timer).
     */
    recordActivity() {
        this.state.lastActivityTime = Date.now();
    }

    /**
     * Record a correct answer.
     */
    recordCorrect() {
        this.state.totalQuestions++;
        this.state.correct++;
        this.state.streak++;
        this.state.lastActivityTime = Date.now();

        console.log(
            `%c[State] ✅ Correct! Score: ${this.state.correct}/${this.state.totalQuestions} | Streak: ${this.state.streak}`,
            'color: #4CAF50; font-weight: bold'
        );
    }

    /**
     * Record a wrong answer.
     */
    recordWrong() {
        this.state.totalQuestions++;
        this.state.wrong++;
        this.state.streak = 0;
        this.state.lastActivityTime = Date.now();

        console.log(
            `%c[State] ❌ Wrong! Score: ${this.state.correct}/${this.state.totalQuestions}`,
            'color: #f44336; font-weight: bold'
        );
    }

    /**
     * Set the current active module.
     */
    setModule(moduleName) {
        this.state.currentModule = moduleName;
    }

    /**
     * Check if solver is stuck.
     */
    _checkStuck() {
        if (!this.state.isRunning || this.state.isPaused) return;

        const elapsed = Date.now() - this.state.lastActivityTime;
        if (elapsed > this._stuckThreshold) {
            console.warn(
                `%c[State] ⚠️ Stuck detected! No activity for ${Math.round(elapsed / 1000)}s`,
                'color: #FF9800; font-weight: bold'
            );

            if (this._onStuck) {
                this._onStuck(elapsed);
            }
        }
    }

    /**
     * Switch to manual mode.
     */
    toManual() {
        this.state.mode = 'manual';
        console.log(
            '%c[State] 🔧 Switched to MANUAL mode. Solver paused.',
            'color: #FF9800; font-weight: bold'
        );
    }

    /**
     * Switch back to auto mode.
     */
    toAuto() {
        this.state.mode = 'auto';
        this.state.lastActivityTime = Date.now();
        console.log(
            '%c[State] 🤖 Switched to AUTO mode. Solver resumed.',
            'color: #2196F3; font-weight: bold'
        );
    }

    /**
     * Get summary stats.
     */
    getSummary() {
        const { correct, wrong, totalQuestions, streak } = this.state;
        const accuracy = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
        return { correct, wrong, totalQuestions, streak, accuracy, mode: this.state.mode };
    }

    /**
     * Log error for debugging.
     */
    logError(error, context = '') {
        this.state.errors.push({
            time: new Date().toISOString(),
            error: error.message || error,
            context
        });
        console.error(`[State] Error in ${context}:`, error);
    }
}
