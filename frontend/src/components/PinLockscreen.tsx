import React, { useState, useEffect, useCallback } from 'react';
import { Lock, Delete, TrendingUp, AlertCircle } from 'lucide-react';
import { apiClient, setSessionToken } from '../services/apiClient';

interface PinLockscreenProps {
  onAuthenticated: () => void;
}

export const PinLockscreen: React.FC<PinLockscreenProps> = ({ onAuthenticated }) => {
  const [digits, setDigits] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shaking, setShaking] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);

  const submitPin = useCallback(
    async (candidatePin: string) => {
      if (verifying || candidatePin.length !== 4) return;
      setVerifying(true);
      setErrorMsg(null);
      try {
        const res = await apiClient.verifyPin(candidatePin);
        if (res.authenticated && res.token) {
          setSessionToken(res.token, candidatePin);
          onAuthenticated();
        } else {
          throw new Error('Incorrect PIN');
        }
      } catch {
        setShaking(true);
        setErrorMsg('Incorrect PIN (Personal Identification Number) — Please try again');
        setTimeout(() => {
          setDigits('');
          setShaking(false);
        }, 420);
      } finally {
        setVerifying(false);
      }
    },
    [verifying, onAuthenticated]
  );

  const appendDigit = useCallback(
    (d: string) => {
      if (verifying) return;
      setErrorMsg(null);
      setDigits((prev) => {
        if (prev.length >= 4) return prev;
        const next = prev + d;
        if (next.length === 4) {
          setTimeout(() => submitPin(next), 60);
        }
        return next;
      });
    },
    [verifying, submitPin]
  );

  const handleBackspace = useCallback(() => {
    if (verifying) return;
    setErrorMsg(null);
    setDigits((prev) => prev.slice(0, -1));
  }, [verifying]);

  const handleClear = useCallback(() => {
    if (verifying) return;
    setErrorMsg(null);
    setDigits('');
  }, [verifying]);

  // Physical Keyboard Support (0-9, Backspace, Escape, Enter)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        appendDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter' && digits.length === 4) {
        e.preventDefault();
        submitPin(digits);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [appendDigit, handleBackspace, handleClear, submitPin, digits]);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 select-none">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-sm">
            <TrendingUp className="w-7 h-7 text-white stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Family<span className="text-emerald-400">Finance</span>
          </h1>
          <p className="text-sm text-slate-300 mt-1.5">
            Enter your 4-digit PIN (Personal Identification Number) to continue
          </p>
        </div>

        {/* 4 Circular PIN Indicator Dots */}
        <div
          className={`flex items-center justify-center gap-4 my-6 ${
            shaking ? 'animate-shake' : ''
          }`}
          aria-label="PIN Indicator Dots"
        >
          {[0, 1, 2, 3].map((idx) => {
            const filled = digits.length > idx;
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-150 ${
                  errorMsg
                    ? 'bg-rose-500 border-2 border-rose-400'
                    : filled
                    ? 'bg-emerald-400 border-2 border-emerald-300 scale-110'
                    : 'bg-slate-950 border-2 border-slate-700'
                }`}
              />
            );
          })}
        </div>

        {/* Status / Error Message */}
        <div className="min-h-[28px] flex items-center justify-center mb-4 text-center">
          {errorMsg ? (
            <div className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : verifying ? (
            <span className="text-sm font-medium text-emerald-400">
              Unlocking FamilyFinance...
            </span>
          ) : (
            <span className="text-sm text-slate-400">
              Type using your keyboard or click the keypad below
            </span>
          )}
        </div>

        {/* 0-9 Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => appendDigit(num)}
              disabled={verifying}
              className="h-14 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800 hover:border-slate-700 text-xl font-mono font-bold text-white transition-all focus:outline-none focus:border-emerald-500"
            >
              {num}
            </button>
          ))}

          {/* Clear Button */}
          <button
            type="button"
            onClick={handleClear}
            disabled={verifying}
            className="h-14 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800 text-sm font-semibold text-slate-300 hover:text-rose-400 transition-all"
          >
            Clear
          </button>

          {/* 0 Digit */}
          <button
            type="button"
            onClick={() => appendDigit('0')}
            disabled={verifying}
            className="h-14 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800 hover:border-slate-700 text-xl font-mono font-bold text-white transition-all focus:outline-none focus:border-emerald-500"
          >
            0
          </button>

          {/* Backspace Button */}
          <button
            type="button"
            onClick={handleBackspace}
            disabled={verifying}
            aria-label="Backspace"
            className="h-14 rounded-xl bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center gap-1.5 text-sm font-medium transition-all"
          >
            <Delete className="w-5 h-5" />
            <span>Back</span>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-center gap-2 text-sm text-slate-400">
          <Lock className="w-4 h-4 text-emerald-400" />
          <span>Private Family Access</span>
        </div>
      </div>
    </div>
  );
};
