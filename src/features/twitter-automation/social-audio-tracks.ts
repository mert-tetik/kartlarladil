export const SOCIAL_AUDIO_TRACKS = [
  { filename: "frutiger-aero-ambient.mp3", label: "Frutiger Aero Ambient", url: "/social-audio/frutiger-aero-ambient.mp3" },
  { filename: "lease-takeshi-abo.mp3", label: "LEASE — Takeshi Abo (Bitcrushed)", url: "/social-audio/lease-takeshi-abo.mp3" },
  { filename: "aquatic-ambience.mp3", label: "Aquatic Ambience", url: "/social-audio/aquatic-ambience.mp3" },
  { filename: "frutiger-aero-playlist.mp3", label: "Frutiger Aero Playlist Cut", url: "/social-audio/frutiger-aero-playlist.mp3" },
  { filename: "frutiger-aero-feels-like-4.mp3", label: "What Frutiger Aero Feels Like — IV", url: "/social-audio/frutiger-aero-feels-like-4.mp3" },
  { filename: "frutiger-aero-feels-like-7.mp3", label: "What Frutiger Aero Feels Like — VII", url: "/social-audio/frutiger-aero-feels-like-7.mp3" },
  { filename: "lotus-waters-speed-up.mp3", label: "Lotus Waters (Speed Up)", url: "/social-audio/lotus-waters-speed-up.mp3" },
] as const;

export function pickSocialAudioTrack(random = Math.random) {
  return SOCIAL_AUDIO_TRACKS[Math.floor(random() * SOCIAL_AUDIO_TRACKS.length)]!;
}
