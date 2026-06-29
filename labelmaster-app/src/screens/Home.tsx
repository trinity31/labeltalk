import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors } from '../lib/theme';
import { Profile, loadProfile, profileSummary } from '../lib/profile';
import { track } from '../lib/analytics';
import { Screen, Spinner } from '../components/ui';

export default function Home() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const p = await loadProfile();
      if (!alive) return;
      if (p == null) {
        // 첫 사용자는 서비스 소개(Intro) → 온보딩 순서로 안내해요.
        navigate('/intro', { replace: true });
        return;
      }
      setProfile(p);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  const handlePick = useCallback(async () => {
    try {
      setPicking(true);
      const { fetchAlbumPhotos } = await import('@apps-in-toss/web-framework');
      const permission = await fetchAlbumPhotos.getPermission();
      const allowed =
        permission === 'allowed' || (await fetchAlbumPhotos.openPermissionDialog()) === 'allowed';
      if (!allowed) {
        alert('사진을 올리려면 앨범 권한을 허용해 주세요.');
        return;
      }
      const photos = await fetchAlbumPhotos({ maxCount: 1, maxWidth: 720, base64: true });
      if (!photos || photos.length === 0) return;
      track('photo_pick');
      navigate('/analyze', { state: { imageBase64: photos[0].dataUri } });
    } catch {
      alert('사진을 불러오지 못했어요. 다시 시도해 주세요.');
    } finally {
      setPicking(false);
    }
  }, [navigate]);

  if (!ready || profile == null) {
    return (
      <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </Screen>
    );
  }

  return (
    <Screen>
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.white,
              fontSize: 17,
              fontWeight: 800,
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.6, color: colors.ink }}>
            이거먹어도돼?
          </div>
        </div>
        <div style={{ fontSize: 15, color: colors.grey500, marginTop: 12, lineHeight: '22px' }}>
          제품 라벨을 찍으면
          <br />
          한마디로 답해드려요.
        </div>

        <div
          style={{
            marginTop: 22,
            background: colors.primaryTint,
            border: `1px solid ${colors.primaryTintBorder}`,
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.primary }}>내 프로필</div>
            <div
              style={{ fontSize: 12, fontWeight: 700, color: colors.primary }}
              onClick={() => navigate('/onboarding')}
            >
              수정 ›
            </div>
          </div>
          <div
            style={{ fontSize: 15, fontWeight: 700, marginTop: 8, color: colors.ink, letterSpacing: -0.3 }}
          >
            {profileSummary(profile)}
          </div>
        </div>

        <div
          onClick={() => {
            if (!picking) handlePick();
          }}
          style={{
            marginTop: 18,
            border: '1.5px dashed #CBD2D6',
            borderRadius: 18,
            padding: '32px 20px',
            textAlign: 'center',
            background: colors.surfaceSoft,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 16,
              background: colors.primaryTint,
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              color: colors.primary,
              fontWeight: 700,
            }}
          >
            ＋
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 14 }}>갤러리에서 라벨 사진 올리기</div>
          <div style={{ fontSize: 13, color: colors.grey500, marginTop: 5 }}>
            원재료표가 잘 보이게 찍어주세요
          </div>
          <div style={{ fontSize: 12, color: colors.grey300, marginTop: 7 }}>
            🎬 분석 시 짧은 광고가 표시돼요
          </div>
        </div>

        <div
          style={{
            fontSize: 12,
            color: colors.grey300,
            marginTop: 24,
            lineHeight: '19px',
            textAlign: 'center',
          }}
        >
          참고용 안내예요. 알레르기·건강 판단은
          <br />
          실제 라벨을 꼭 확인해 주세요.
        </div>

        <button
          onClick={() => navigate('/intro')}
          style={{
            display: 'block',
            margin: '14px auto 4px',
            background: 'none',
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            color: colors.grey400,
            textDecoration: 'underline',
          }}
        >
          튜토리얼 다시 보기
        </button>
      </div>
    </Screen>
  );
}
