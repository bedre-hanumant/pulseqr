import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteUser, updatePassword, updateProfile } from 'firebase/auth';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { GlassButton } from '../components/GlassUI';
import { useApp } from '../context/AppContext';
import { deleteUserDataRecords, updateUserProfileRecord } from '../firebase/firestore';
import { uploadImageAsset } from '../firebase/storage';

export const ProfilePage: React.FC = () => {
  const { user, profile, notify, confirm, refreshProfile, logout } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState(profile?.name || user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || user?.photoURL || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setPhotoURL(profile.photoURL);
    }
  }, [profile]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    try {
      const { url } = await uploadImageAsset(file, 'avatars', user.uid);
      setPhotoURL(url);
      notify('Photo ready', 'success', 'Click Save Profile to apply.');
    } catch (err) {
      notify('Photo upload failed', 'error', err instanceof Error ? err.message : 'Try a smaller image.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateUserProfileRecord(user.uid, { name: name.trim(), photoURL });
      try {
        await updateProfile(user, {
          displayName: name.trim(),
          photoURL: photoURL.startsWith('http') ? photoURL : user.photoURL,
        });
      } catch {
        // Ignore Auth photoURL length limit when using compressed data URI
      }
      await refreshProfile();
      notify('Profile updated', 'success');
    } catch (err) {
      notify('Failed to update profile', 'error', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword.length < 6) {
      notify('Weak password', 'error', 'Use at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      notify('Passwords do not match', 'error');
      return;
    }
    setChangingPwd(true);
    try {
      await updatePassword(user, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      notify('Password updated', 'success', 'Your new password is now active.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to change password.';
      notify(
        'Re-authentication may be required',
        'error',
        msg.includes('recent-login')
          ? 'Sign out and sign back in before changing your password.'
          : msg
      );
    } finally {
      setChangingPwd(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    const ok = await confirm({
      title: 'Delete your account permanently?',
      message:
        'All your dynamic QR codes, scan analytics, and profile data will be erased permanently. Printed QR codes will stop redirecting.',
      confirmLabel: 'Delete Account',
      danger: true,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      await deleteUserDataRecords(user.uid);
      await deleteUser(user);
      notify('Account deleted', 'info');
      navigate('/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not delete account.';
      if (msg.includes('recent-login')) {
        notify('Recent login required', 'error', 'Please sign out, sign back in, and retry account deletion.');
        await logout();
        navigate('/login');
      } else {
        notify('Deletion failed', 'error', msg);
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout title="Profile" breadcrumb="Profile">
      <div className="max-w-3xl space-y-6">
        {/* Account Details */}
        <form onSubmit={handleSaveProfile} className="glass-panel rounded-[26px] p-6 sm:p-8 space-y-6">
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">
            Account Information
          </h2>

          <div className="flex flex-wrap items-center gap-5">
            {photoURL ? (
              <img
                src={photoURL}
                alt={name}
                referrerPolicy="no-referrer"
                className="w-18 h-18 rounded-[20px] object-cover border border-white/60 dark:border-white/15 shadow-sm"
              />
            ) : (
              <div className="w-18 h-18 rounded-[20px] bg-gradient-to-br from-blue-600 via-violet-600 to-pink-500 text-white text-xl font-bold flex items-center justify-center shadow-md">
                {(name || user?.email || 'U').slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="space-y-2">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl glass-panel text-xs font-semibold cursor-pointer hover:bg-white/90 dark:hover:bg-slate-800/80 transition-all">
                {uploadingPhoto ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                )}
                Upload Profile Photo
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                PNG, JPG, or WebP. Stored in Firebase Storage or compressed safely.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm opacity-65 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-900/6 dark:border-white/[0.08]">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Role: <strong className="capitalize text-slate-800 dark:text-slate-200">{profile?.role || 'user'}</strong> · Plan:{' '}
              <strong className="capitalize text-slate-800 dark:text-slate-200">{profile?.plan || 'free'}</strong>
            </p>
            <GlassButton type="submit" variant="gradient" disabled={savingProfile}>
              {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Profile
            </GlassButton>
          </div>
        </form>

        {/* Change Password */}
        <form onSubmit={handleChangePassword} className="glass-panel rounded-[26px] p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">
              Change Password
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Set or update your Email/Password sign-in credentials.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                minLength={6}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                minLength={6}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full px-4 py-2.5 rounded-2xl glass-input text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <GlassButton type="submit" variant="primary" disabled={changingPwd}>
              {changingPwd && <Loader2 className="w-4 h-4 animate-spin" />}
              Update Password
            </GlassButton>
          </div>
        </form>

        {/* Danger Zone */}
        <div className="glass-panel rounded-[26px] p-6 sm:p-8 border-rose-500/25">
          <h2 className="text-base font-semibold text-rose-600 dark:text-rose-400">
            Delete Account
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Permanently remove your profile, all generated dynamic QR codes, and historical scan
            logs from Firestore and Firebase Authentication.
          </p>
          <div className="mt-5">
            <GlassButton variant="danger" disabled={deleting} onClick={handleDeleteAccount}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Delete Account Permanently
            </GlassButton>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
