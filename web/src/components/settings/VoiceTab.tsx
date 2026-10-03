import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { Select } from '../common/Select';
import { ttsSettingsService, type TtsSettings } from '../../services/ttsSettingsService';
import { SettingsAlert } from './SettingsAlert';
import { SaveFooter } from './SaveFooter';

export const VoiceTab: React.FC = () => {
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(() => ttsSettingsService.load());
  const [success, setSuccess] = useState(false);

  const handleSave = () => {
    ttsSettingsService.save(ttsSettings);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold text-text-main">Voice Synthesis</h3>
          <p className="text-sm text-text-muted mt-1">
            Uses Microsoft Edge TTS for free, high-quality neural speech. No API key required.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-main">Voice</label>
            <Select
              value={ttsSettings.voice}
              onChange={(e) => { setSuccess(false); setTtsSettings(s => ({ ...s, voice: e.target.value })); }}
              className="w-full"
              selectClassName="px-4 py-2.5"
            >
              <optgroup label="English">
                <option value="en-US-AriaNeural">Aria (US Female)</option>
                <option value="en-US-GuyNeural">Guy (US Male)</option>
                <option value="en-US-JennyNeural">Jenny (US Female)</option>
                <option value="en-GB-SoniaNeural">Sonia (UK Female)</option>
                <option value="en-GB-RyanNeural">Ryan (UK Male)</option>
                <option value="en-AU-NatashaNeural">Natasha (AU Female)</option>
              </optgroup>
              <optgroup label="Chinese">
                <option value="zh-CN-XiaoxiaoNeural">晓晓 (Mainland Female)</option>
                <option value="zh-CN-YunxiNeural">云希 (Mainland Male)</option>
                <option value="zh-CN-XiaoyiNeural">晓伊 (Mainland Female)</option>
                <option value="zh-CN-YunyangNeural">云扬 (Mainland Male)</option>
                <option value="zh-TW-HsiaoChenNeural">曉臻 (Taiwan Female)</option>
                <option value="zh-HK-HiuGaaiNeural">曉佳 (HK Female)</option>
              </optgroup>
              <optgroup label="Japanese">
                <option value="ja-JP-NanamiNeural">Nanami (JP Female)</option>
                <option value="ja-JP-KeitaNeural">Keita (JP Male)</option>
              </optgroup>
              <optgroup label="Korean">
                <option value="ko-KR-SunHiNeural">SunHi (KR Female)</option>
                <option value="ko-KR-InJoonNeural">InJoon (KR Male)</option>
              </optgroup>
              <optgroup label="French">
                <option value="fr-FR-DeniseNeural">Denise (FR Female)</option>
                <option value="fr-FR-HenriNeural">Henri (FR Male)</option>
              </optgroup>
              <optgroup label="Spanish">
                <option value="es-ES-ElviraNeural">Elvira (ES Female)</option>
                <option value="es-MX-DaliaNeural">Dalia (MX Female)</option>
              </optgroup>
              <optgroup label="German">
                <option value="de-DE-KatjaNeural">Katja (DE Female)</option>
                <option value="de-DE-ConradNeural">Conrad (DE Male)</option>
              </optgroup>
            </Select>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
          <Info size={14} className="mt-0.5 text-[var(--primary)] shrink-0" />
          <p className="text-[10px] leading-relaxed text-zinc-500">
            Powered by Microsoft Edge neural voices. Free to use with no usage limits.
          </p>
        </div>

        {success && <SettingsAlert kind="success">Voice settings saved.</SettingsAlert>}
      </div>
      <SaveFooter onSave={handleSave} />
    </>
  );
};
