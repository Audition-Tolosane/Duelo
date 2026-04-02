/**
 * Tests for game scoring logic and endGame navigation behaviour.
 * These are pure unit tests — no React rendering needed.
 */

// ── Constants (mirrors game.tsx) ──────────────────────────────────────────
const TIMER_DURATION = 10;
const MAX_PTS_PER_Q = 20;
const TOTAL_QUESTIONS = 7;
const MAX_TOTAL = MAX_PTS_PER_Q * TOTAL_QUESTIONS; // 140

// ── Scoring helper (same formula as game.tsx selectAnswer) ───────────────
function calcPoints(isCorrect: boolean, timeTaken: number): number {
  return isCorrect ? Math.max(MAX_PTS_PER_Q - timeTaken, 10) : 0;
}

// ── Bot resolution (mirrors game.tsx resolveBotAnswer) ───────────────────
function resolveBotAnswer(correctOption: number, seed: number) {
  // deterministic version using seed instead of Math.random()
  const botCorrect = seed > 0.35;
  if (botCorrect) {
    const botTime = Math.floor((seed * 10) % 8) + 2;
    return { botPick: correctOption, botPts: Math.max(MAX_PTS_PER_Q - botTime, 10) };
  }
  const wrongOpts = [0, 1, 2, 3].filter(i => i !== correctOption);
  return { botPick: wrongOpts[0], botPts: 0 };
}

// ── Answer history helper (mirrors asyncSolo tracking) ───────────────────
type AnswerRecord = { answer: number; is_correct: boolean; points: number; time_ms: number };

function recordAnswer(
  optionIndex: number,
  isCorrect: boolean,
  points: number,
  timeTaken: number
): AnswerRecord {
  return { answer: optionIndex, is_correct: isCorrect, points, time_ms: timeTaken * 1000 };
}

function recordTimeout(): AnswerRecord {
  return { answer: -1, is_correct: false, points: 0, time_ms: TIMER_DURATION * 1000 };
}

// ─────────────────────────────────────────────────────────────────────────

describe('calcPoints — per-question scoring', () => {
  it('awards MAX_PTS for instant correct answer', () => {
    expect(calcPoints(true, 0)).toBe(20);
  });

  it('deducts 1 point per second taken', () => {
    expect(calcPoints(true, 5)).toBe(15);
    expect(calcPoints(true, 9)).toBe(11);
  });

  it('floors at 10 even if time > 10s (overtime)', () => {
    expect(calcPoints(true, 10)).toBe(10);
    expect(calcPoints(true, 15)).toBe(10);
    expect(calcPoints(true, 100)).toBe(10);
  });

  it('awards 0 for wrong answer regardless of time', () => {
    expect(calcPoints(false, 0)).toBe(0);
    expect(calcPoints(false, 3)).toBe(0);
    expect(calcPoints(false, 9)).toBe(0);
  });
});

describe('perfect game scoring', () => {
  it('perfect 7/7 answering instantly = 140 pts', () => {
    const total = Array.from({ length: TOTAL_QUESTIONS }, () => calcPoints(true, 0))
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(MAX_TOTAL);
  });

  it('perfect 7/7 but slow (5s each) = 7 * 15 = 105', () => {
    const total = Array.from({ length: TOTAL_QUESTIONS }, () => calcPoints(true, 5))
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(105);
  });

  it('0/7 correct = 0 pts', () => {
    const total = Array.from({ length: TOTAL_QUESTIONS }, () => calcPoints(false, 2))
      .reduce((a, b) => a + b, 0);
    expect(total).toBe(0);
  });
});

describe('bot resolution', () => {
  it('bot is correct when seed > 0.35', () => {
    const { botPick, botPts } = resolveBotAnswer(2, 0.9);
    expect(botPick).toBe(2);
    expect(botPts).toBeGreaterThanOrEqual(10);
  });

  it('bot picks a wrong option when seed <= 0.35', () => {
    const { botPick, botPts } = resolveBotAnswer(2, 0.1);
    expect(botPick).not.toBe(2);
    expect(botPts).toBe(0);
  });

  it('bot pts are always >= 10 when correct', () => {
    for (let seed = 0.36; seed <= 1.0; seed += 0.05) {
      const { botPts } = resolveBotAnswer(0, seed);
      expect(botPts).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('async answer history recording', () => {
  it('correct answer records correct fields', () => {
    const rec = recordAnswer(2, true, 18, 2);
    expect(rec.answer).toBe(2);
    expect(rec.is_correct).toBe(true);
    expect(rec.points).toBe(18);
    expect(rec.time_ms).toBe(2000);
  });

  it('wrong answer records 0 points', () => {
    const rec = recordAnswer(1, false, 0, 4);
    expect(rec.is_correct).toBe(false);
    expect(rec.points).toBe(0);
  });

  it('timeout records answer=-1, 0 points, full timer duration', () => {
    const rec = recordTimeout();
    expect(rec.answer).toBe(-1);
    expect(rec.is_correct).toBe(false);
    expect(rec.points).toBe(0);
    expect(rec.time_ms).toBe(TIMER_DURATION * 1000);
  });

  it('full 7-question game history has exactly 7 records', () => {
    const history: AnswerRecord[] = [];
    // 5 correct, 1 wrong, 1 timeout
    history.push(recordAnswer(0, true, 20, 0));
    history.push(recordAnswer(1, true, 15, 5));
    history.push(recordAnswer(2, false, 0, 3));
    history.push(recordAnswer(0, true, 12, 8));
    history.push(recordTimeout());
    history.push(recordAnswer(3, true, 18, 2));
    history.push(recordAnswer(1, true, 14, 6));

    expect(history).toHaveLength(7);
    expect(history.filter(r => r.is_correct).length).toBe(5);
    expect(history.filter(r => r.answer === -1).length).toBe(1);
    const totalPts = history.reduce((sum, r) => sum + r.points, 0);
    expect(totalPts).toBe(20 + 15 + 0 + 12 + 0 + 18 + 14); // 79
  });
});

describe('endGame navigation logic', () => {
  // Mirror the decision tree in game.tsx endGame()
  function getResultRoute(
    saveResult: { ok: boolean; data?: any },
    isAsyncSolo: boolean,
    ps: number,
    opponentPseudo: string
  ): string {
    if (saveResult.ok && saveResult.data?.status === 'completed') {
      const oppScore = isAsyncSolo ? saveResult.data.p2_score : saveResult.data.p1_score;
      return `results:completed:${ps}:${oppScore}`;
    }
    return `results:async_banner:${ps}`;
  }

  it('navigates to completed results when both have played', () => {
    const route = getResultRoute(
      { ok: true, data: { status: 'completed', p1_score: 80, p2_score: 60 } },
      true, // isAsyncSolo = Player A
      80,
      'Bob'
    );
    expect(route).toBe('results:completed:80:60');
  });

  it('uses p1_score as opponent when Player B finishes (reveal mode)', () => {
    const route = getResultRoute(
      { ok: true, data: { status: 'completed', p1_score: 100, p2_score: 75 } },
      false, // isAsyncReveal = Player B
      75,
      'Alice'
    );
    expect(route).toBe('results:completed:75:100');
  });

  it('shows async banner when only first player has played', () => {
    const route = getResultRoute(
      { ok: true, data: { status: 'waiting_for_opponent' } },
      true,
      80,
      'Bob'
    );
    expect(route).toBe('results:async_banner:80');
  });

  it('shows async banner on network error', () => {
    const route = getResultRoute({ ok: false }, true, 80, 'Bob');
    expect(route).toBe('results:async_banner:80');
  });
});
