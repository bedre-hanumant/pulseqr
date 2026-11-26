import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, MapPin, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { submitContactMessage } from '../firebase/firestore';
import { DashboardLayout } from '../components/DashboardLayout';
import {
  AmbientAurora,
  GlassButton,
  PageTransition,
  SuccessCheckAnimation,
} from '../components/GlassUI';

export const ContactPage: React.FC = () => {
  const { user, profile, notify } = useApp();
  const [name, setName] = useState(profile?.name || user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 5) {
      notify('Message too short', 'error', 'Please enter at least 5 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await submitContactMessage({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        userId: user?.uid || '',
      });
      setSubmitted(true);
      setSubject('');
      setMessage('');
      notify('Message received', 'success', 'Our support team has logged your inquiry.');
    } catch (err) {
      notify('Could not send message', 'error', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-5 space-y-6">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white">
            Talk with the PulseQR team
          </h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Questions about custom redirect domains, high-volume bulk campaigns, or enterprise
            Firestore deployments? Send us a direct note.
          </p>
        </div>

        <div className="glass-panel rounded-[26px] p-6 space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-blue-600/15 to-cyan-500/15 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">Direct Support</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">support@pulseqr.app</p>
            </div>
          </div>
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-600/15 to-pink-500/15 text-violet-600 dark:text-pink-400 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">Response Window</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                Monday – Friday · Under 4 business hours
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-7">
        <div className="glass-panel rounded-[28px] p-7 sm:p-9">
          {submitted ? (
            <div className="py-10 text-center">
              <SuccessCheckAnimation size={54} />
              <h3 className="mt-5 text-lg font-bold text-slate-950 dark:text-white">
                Inquiry submitted
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                Your message has been saved securely and routed to our operations team.
              </p>
              <div className="mt-6">
                <GlassButton variant="gradient" onClick={() => setSubmitted(false)}>
                  Send another message
                </GlassButton>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jordan Lee"
                    className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jordan@company.com"
                    className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Custom domain setup or enterprise onboarding"
                  className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Message
                </label>
                <textarea
                  rows={5}
                  required
                  minLength={5}
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us about your QR deployment goals or any question you have..."
                  className="w-full px-4 py-3 rounded-2xl glass-input text-sm"
                />
              </div>

              <div className="pt-2">
                <GlassButton type="submit" variant="gradient" size="lg" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send Message
                </GlassButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  if (user) {
    return (
      <DashboardLayout title="Contact & Support" breadcrumb="Support">
        {content}
      </DashboardLayout>
    );
  }

  return (
    <div className="min-h-screen relative bg-[#F5F7FC] dark:bg-[#050711] py-12 px-4 sm:px-6 lg:px-8">
      <AmbientAurora />
      <PageTransition className="max-w-5xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl glass-panel text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/80 mb-8 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to PulseQR
        </Link>
        {content}
      </PageTransition>
    </div>
  );
};
