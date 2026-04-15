/**
 * LoginScreen — phone number + OTP authentication
 * Brand: GHMC Navy #002B5C | Heritage Gold #F5A623 | tricolour stripe
 *
 * Flow
 * ────
 *   PHONE  → user enters 10-digit mobile number; taps "Send OTP"
 *   OTP    → 6-box digit entry with auto-advance; 30s resend countdown
 *   verify → transitions to app home on success
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, Animated,
  ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';

// ── brand ────────────────────────────────────────────────────
const NAVY  = '#002B5C';
const GOLD  = '#F5A623';
const GREEN = '#058541';
const SAFFRON = '#FF9933';

// ── OTP length ───────────────────────────────────────────────
const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

// ── Tricolour stripe ─────────────────────────────────────────
function Tricolour() {
  return (
    <View style={styles.tricolour}>
      <View style={[styles.triStripe, { backgroundColor: SAFFRON }]} />
      <View style={[styles.triStripe, { backgroundColor: '#ffffff' }]} />
      <View style={[styles.triStripe, { backgroundColor: GREEN }]} />
    </View>
  );
}

// ── Main component ───────────────────────────────────────────
type Step = 'phone' | 'otp';

export default function LoginScreen() {
  const router = useRouter();
  const { setAuthenticated } = useAuthStore();

  const [step, setStep]         = useState<Step>('phone');
  const [phone, setPhone]       = useState('');
  const [otp, setOtp]           = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [sending, setSending]   = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const otpRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkAnim = useRef(new Animated.Value(0)).current;

  // ── Cleanup on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  // ── Countdown timer ──────────────────────────────────────────
  const startCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(RESEND_SECONDS);
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(countdownRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  }, []);

  // ── Send OTP ─────────────────────────────────────────────────
  const handleSendOtp = useCallback(() => {
    if (phone.length < 10 || sending) return;
    setSending(true);
    // TODO: replace with real API call: await mobileApi.sendOtp(phone)
    setTimeout(() => {
      setSending(false);
      setStep('otp');
      startCountdown();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }, 1200);
  }, [phone, sending, startCountdown]);

  // ── OTP input handling ───────────────────────────────────────
  const handleOtpChange = useCallback((index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }, [otp]);

  const handleOtpKey = useCallback((index: number, key: string) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }, [otp]);

  const otpFilled = otp.every(d => d !== '');

  // ── Verify OTP ───────────────────────────────────────────────
  const handleVerify = useCallback(() => {
    if (!otpFilled || verifying) return;
    setVerifying(true);
    // TODO: replace with real API call: await mobileApi.verifyOtp(phone, otp.join(''))
    setTimeout(() => {
      setVerifying(false);
      setAuthenticated(true);
      router.replace('/(tabs)/home');
    }, 1400);
  }, [otpFilled, verifying, router, setAuthenticated]);

  // ── Resend OTP ───────────────────────────────────────────────
  const handleResend = useCallback(() => {
    setOtp(Array(OTP_LENGTH).fill(''));
    startCountdown();
    otpRefs.current[0]?.focus();
    // TODO: await mobileApi.sendOtp(phone)
  }, [startCountdown]);

  // ── Back to phone step ───────────────────────────────────────
  const backToPhone = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setStep('phone');
    setOtp(Array(OTP_LENGTH).fill(''));
    setCountdown(0);
  }, []);

  // ── Derived UI states ────────────────────────────────────────
  const canSend   = phone.length >= 10 && !sending;
  const canVerify = otpFilled && !verifying;

  // ── Render ───────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Hero header */}
      <View style={styles.hero}>
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>🛣️</Text>
        </View>
        <Text style={styles.appName}>Mana Rasta</Text>
        <Text style={styles.appSub}>GHMC Pothole Reporting · Hyderabad</Text>
      </View>

      <Tricolour />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 'phone' ? (
            /* ── Phone step ─────────────────────────────────── */
            <>
              <Text style={styles.fieldLabel}>Mobile number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.prefix}>
                  <Text style={styles.prefixText}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={t => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                  placeholder="98765 43210"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="done"
                  onSubmitEditing={handleSendOtp}
                />
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, { backgroundColor: canSend ? GOLD : '#e5e7eb' }]}
                onPress={handleSendOtp}
                disabled={!canSend}
                activeOpacity={0.85}
              >
                {sending
                  ? <ActivityIndicator color={NAVY} />
                  : <Text style={[styles.btnPrimaryText, { color: canSend ? NAVY : '#9ca3af' }]}>Send OTP</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            /* ── OTP step ───────────────────────────────────── */
            <>
              <Text style={styles.otpSentMsg}>OTP sent to +91 {phone}</Text>

              {/* 6-digit boxes */}
              <View style={styles.otpRow}>
                {otp.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                    value={digit}
                    onChangeText={v => handleOtpChange(i, v)}
                    onKeyPress={({ nativeEvent }) => handleOtpKey(i, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    selectTextOnFocus
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, { backgroundColor: canVerify ? GOLD : '#e5e7eb', marginTop: 14 }]}
                onPress={handleVerify}
                disabled={!canVerify}
                activeOpacity={0.85}
              >
                {verifying
                  ? <ActivityIndicator color={NAVY} />
                  : <Text style={[styles.btnPrimaryText, { color: canVerify ? NAVY : '#9ca3af' }]}>Verify &amp; Continue</Text>
                }
              </TouchableOpacity>

              {/* Resend / countdown */}
              <View style={styles.resendRow}>
                {countdown > 0 ? (
                  <Text style={styles.countdownText}>
                    Resend in 0:{String(countdown).padStart(2, '0')}
                  </Text>
                ) : (
                  <TouchableOpacity onPress={handleResend}>
                    <Text style={styles.resendText}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity onPress={backToPhone} style={styles.changeNumBtn}>
                <Text style={styles.changeNumText}>← Change number</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Footer */}
          <Text style={styles.footer}>
            By continuing you agree to our Terms of Service.{'\n'}
            Mana Rasta helps fix Hyderabad's roads together.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: NAVY,
  },
  hero: {
    backgroundColor: NAVY,
    paddingTop: 12,
    paddingBottom: 28,
    alignItems: 'center',
    gap: 8,
  },
  logoBox: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.25)',
    marginBottom: 4,
  },
  logoEmoji: {
    fontSize: 34,
  },
  appName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  appSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.3,
  },
  tricolour: {
    flexDirection: 'row',
    height: 5,
  },
  triStripe: {
    flex: 1,
  },
  body: {
    backgroundColor: '#ffffff',
    flexGrow: 1,
    padding: 24,
    gap: 0,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    marginTop: 4,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  prefix: {
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  prefixText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
  },
  btnPrimary: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
  },
  otpSentMsg: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 14,
    marginTop: 4,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  otpBox: {
    width: 44,
    height: 54,
    fontSize: 22,
    fontWeight: '700',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    color: NAVY,
  },
  otpBoxFilled: {
    borderColor: NAVY,
    backgroundColor: '#EBF0F9',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 12,
  },
  countdownText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  resendText: {
    fontSize: 13,
    color: GOLD,
    fontWeight: '600',
  },
  changeNumBtn: {
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
  },
  changeNumText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 32,
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
  },
});
