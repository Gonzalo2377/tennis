/* ============================================================
   MUNDIAL VALUE — probability model
   ------------------------------------------------------------
   Bivariate Poisson with Dixon–Coles low-score correction.
   Pipeline:
     FIFA rank ──► Elo-style rating ──► (+ recent form)
                                     ──► (+ venue adjustment)
        rating gap ──► expected-goal supremacy (sup)
        combined quality ──► expected total goals (totals)
        λ_home = (totals + sup)/2 ,  λ_away = (totals − sup)/2
        score grid 0..10 × Dixon–Coles τ ──► P(home / draw / away)
   The same shape is what the daily cron should feed via daily.json.
   ============================================================ */
(function () {
    'use strict';

    /* FIFA rank -> Elo-like rating (≈2060 for #1, decaying) */
    function ratingFromRank(rank) {
        return 1500 + 560 * Math.exp(-0.035 * (rank - 1));
    }

    /* base strength rating: clubs carry an explicit Elo, national teams
       derive it from their FIFA rank. Either feeds the same engine. */
    function baseRating(team) {
        if (!team) return ratingFromRank(55);
        if (team.elo != null) return team.elo;
        return ratingFromRank(team.fifa != null ? team.fifa : 55);
    }

    /* recent form (e.g. "WWDLW") -> Elo nudge in roughly [-42, +42] */
    function formScore(form) {
        if (!form) return 0;
        const pts = { W: 3, D: 1, L: 0 };
        let s = 0, n = 0;
        for (const ch of form) if (pts[ch] != null) { s += pts[ch]; n++; }
        if (!n) return 0;
        const ppg = s / n;          // 0..3
        return (ppg - 1.5) * 28;    // centred on a draw
    }

    /* Poisson pmf with memoised factorials */
    const fact = [1];
    function factorial(n) {
        if (fact[n] != null) return fact[n];
        let r = fact[fact.length - 1];
        for (let i = fact.length; i <= n; i++) { r *= i; fact[i] = r; }
        return fact[n];
    }
    function poisson(k, lambda) {
        return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
    }

    /* Dixon–Coles dependence correction for low scores (rho < 0) */
    function dcTau(i, j, lh, la, rho) {
        if (i === 0 && j === 0) return 1 - lh * la * rho;
        if (i === 0 && j === 1) return 1 + lh * rho;
        if (i === 1 && j === 0) return 1 + la * rho;
        if (i === 1 && j === 1) return 1 - rho;
        return 1;
    }

    /* main: probabilities + the intermediate quantities (for transparency) */
    function computeModel(homeId, awayId, opts) {
        opts = opts || {};
        const T = window.TEAMS, H = T[homeId], A = T[awayId];
        if (!H || !A) return { home: 1 / 3, draw: 1 / 3, away: 1 / 3 };

        const rH = baseRating(H) + formScore(H.form);
        const rA = baseRating(A) + formScore(A.form);

        // World Cup group games are at neutral venues -> tiny nominal edge only
        const homeAdv = opts.neutral === false ? 65 : (opts.homeAdv != null ? opts.homeAdv : 16);
        const dr = rH - rA + homeAdv;

        const sup = dr / 120;                       // expected goal supremacy
        const avg = (rH + rA) / 2;
        let totals = 2.7 - (avg - 1850) / 650;      // stronger sides -> slightly tighter
        totals = Math.max(2.1, Math.min(3.1, totals));

        const lh = Math.max(0.18, (totals + sup) / 2);
        const la = Math.max(0.18, (totals - sup) / 2);

        const rho = -0.08, MAX = 10;
        let pH = 0, pD = 0, pA = 0;
        for (let i = 0; i <= MAX; i++) {
            const pi = poisson(i, lh);
            for (let j = 0; j <= MAX; j++) {
                const p = pi * poisson(j, la) * dcTau(i, j, lh, la, rho);
                if (i > j) pH += p; else if (i === j) pD += p; else pA += p;
            }
        }
        const s = pH + pD + pA || 1;
        return {
            home: pH / s, draw: pD / s, away: pA / s,
            lambdaH: lh, lambdaA: la,
            ratingH: rH, ratingA: rA, sup,
        };
    }

    window.ratingFromRank = ratingFromRank;
    window.baseRating = baseRating;
    window.formScore = formScore;
    window.computeModel = computeModel;

    /* attach a fresh model to every match (overrides any sample probs) */
    if (window.MATCHES) {
        window.MATCHES.forEach(function (m) {
            m.model = computeModel(m.home, m.away, { neutral: true });
        });
    }
})();
