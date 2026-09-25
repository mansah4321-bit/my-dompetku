import { supabase } from '../lib/supabase';

// Helper kompresi gambar foto profil agar sangat ringan (~5-10 KB), cepat dimuat, dan sinkron ke semua device
export const compressAvatarImage = (
  file: File,
  maxWidth = 200,
  maxHeight = 200,
  quality = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Crop square dari tengah agar avatar rapi melingkar
        const size = Math.min(width, height);
        const startX = (width - size) / 2;
        const startY = (height - size) / 2;

        canvas.width = Math.min(maxWidth, size);
        canvas.height = Math.min(maxHeight, size);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            img,
            startX,
            startY,
            size,
            size,
            0,
            0,
            canvas.width,
            canvas.height
          );
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

/**
 * Mengambil foto profil terbaru dari Supabase Server (Auth Metadata + Database)
 * Memastikan device lain yang login langsung mendapatkan foto profil yang sama
 */
export async function fetchUserAvatarFromSupabase(userId: string): Promise<string | null> {
  if (!userId || userId === 'guest') return null;

  try {
    // 1. Ambil data user segar langsung dari Supabase Auth Server (bukan cuma token lokal)
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (!userError && userData?.user) {
      const metaAvatar =
        userData.user.user_metadata?.avatar_url ||
        userData.user.user_metadata?.avatar ||
        userData.user.user_metadata?.picture;
      if (metaAvatar && typeof metaAvatar === 'string' && metaAvatar.trim()) {
        // Update cache lokal device ini
        try {
          localStorage.setItem(`mydompet_usr_${userId}_avatar`, metaAvatar);
        } catch {}
        return metaAvatar;
      }
    }

    // 2. Jika tidak ada di metadata, cek di database user_settings
    try {
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('avatar_url')
        .eq('user_id', userId)
        .maybeSingle();

      if (settingsData?.avatar_url && typeof settingsData.avatar_url === 'string' && settingsData.avatar_url.trim()) {
        try {
          localStorage.setItem(`mydompet_usr_${userId}_avatar`, settingsData.avatar_url);
        } catch {}
        return settingsData.avatar_url;
      }
    } catch {}

    // 3. Cek di tabel profiles (jika ada)
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .maybeSingle();

      if (profileData?.avatar_url && typeof profileData.avatar_url === 'string' && profileData.avatar_url.trim()) {
        try {
          localStorage.setItem(`mydompet_usr_${userId}_avatar`, profileData.avatar_url);
        } catch {}
        return profileData.avatar_url;
      }
    } catch {}

    return null;
  } catch (err) {
    console.error('Error fetching user avatar from Supabase:', err);
    return null;
  }
}

/**
 * Menyimpan foto profil ke Supabase Cloud (Storage + Auth Metadata + Database)
 * Tersinkronisasi secara instan ke semua perangkat
 */
export async function saveUserAvatarToSupabase(
  userId: string,
  avatarUrlOrFile: string | File
): Promise<{ success: boolean; avatarUrl: string; error?: string }> {
  if (!userId || userId === 'guest') {
    return { success: false, avatarUrl: '', error: 'User tidak valid' };
  }

  let finalAvatarUrl = '';

  try {
    // 1. Persiapkan data avatar
    if (typeof avatarUrlOrFile === 'string') {
      finalAvatarUrl = avatarUrlOrFile;
    } else {
      // Coba upload ke Supabase Storage (bucket 'avatars') terlebih dahulu jika tersedia
      let uploadedToStorage = false;
      try {
        const fileExt = avatarUrlOrFile.name.split('.').pop() || 'jpg';
        const filePath = `${userId}/avatar_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, avatarUrlOrFile, { upsert: true });

        if (!uploadError) {
          const { data: pubData } = supabase.storage.from('avatars').getPublicUrl(filePath);
          if (pubData?.publicUrl) {
            finalAvatarUrl = pubData.publicUrl;
            uploadedToStorage = true;
          }
        }
      } catch {
        // Fallback ke base64 jika storage bucket belum dibuat
      }

      if (!uploadedToStorage) {
        // Kompres ke base64 ultra-ringan (~6-9KB)
        finalAvatarUrl = await compressAvatarImage(avatarUrlOrFile, 200, 200, 0.8);
      }
    }

    // 2. Simpan ke Supabase Auth User Metadata (otomatis dibawa saat login di device mana pun)
    const { error: authError } = await supabase.auth.updateUser({
      data: {
        avatar_url: finalAvatarUrl,
        avatar: finalAvatarUrl,
        picture: finalAvatarUrl,
      },
    });

    if (authError) {
      console.warn('Supabase auth.updateUser warning:', authError.message);
    }

    // 3. Simpan ke database public.user_settings (tabel pengaturan per user)
    try {
      await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: userId,
            avatar_url: finalAvatarUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    } catch {}

    // 4. Simpan ke database public.profiles (tabel profil per user jika ada)
    try {
      await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            avatar_url: finalAvatarUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
    } catch {}

    // 5. Update cache lokal device ini
    try {
      if (finalAvatarUrl) {
        localStorage.setItem(`mydompet_usr_${userId}_avatar`, finalAvatarUrl);
      } else {
        localStorage.removeItem(`mydompet_usr_${userId}_avatar`);
      }
    } catch {}

    return { success: true, avatarUrl: finalAvatarUrl };
  } catch (err: any) {
    console.error('Error saving user avatar to Supabase:', err);
    return { success: false, avatarUrl: finalAvatarUrl, error: err?.message || 'Gagal menyimpan foto' };
  }
}

/**
 * Menghapus foto profil dari semua database dan Supabase Auth
 */
export async function removeUserAvatarFromSupabase(userId: string): Promise<void> {
  if (!userId || userId === 'guest') return;

  try {
    await supabase.auth.updateUser({
      data: {
        avatar_url: '',
        avatar: '',
        picture: '',
      },
    });

    try {
      await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: userId,
            avatar_url: '',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    } catch {}

    try {
      await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            avatar_url: '',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
    } catch {}

    try {
      localStorage.removeItem(`mydompet_usr_${userId}_avatar`);
    } catch {}
  } catch (e) {
    console.error('Error removing avatar:', e);
  }
}
