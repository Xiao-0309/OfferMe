/* Modified for OfferMe (2026); derived from MeetingCopilot. See UPSTREAM.md. */
import { describe, expect, it } from 'vitest';
import { isJunkTranscript } from '../electron/asr/engine';

describe('isJunkTranscript', () => {
  it('filters empty and punctuation-only output', () => {
    expect(isJunkTranscript('')).toBe(true);
    expect(isJunkTranscript('   ')).toBe(true);
    expect(isJunkTranscript(' . ')).toBe(true);
    expect(isJunkTranscript('。。。')).toBe(true);
    expect(isJunkTranscript('~~~')).toBe(true);
  });

  it('filters classic whisper hallucinations (zh + en)', () => {
    expect(isJunkTranscript('谢谢观看')).toBe(true);
    expect(isJunkTranscript('谢谢大家')).toBe(true);
    expect(isJunkTranscript('请不吝点赞 订阅 转发 打赏')).toBe(true);
    expect(isJunkTranscript('字幕由阿明制作')).toBe(true);
    expect(isJunkTranscript('Thank you for watching!')).toBe(true);
    expect(isJunkTranscript('Please like and subscribe')).toBe(true);
    expect(isJunkTranscript('Subtitles by the community')).toBe(true);
  });

  it('keeps real speech', () => {
    expect(isJunkTranscript('你好，世界')).toBe(false);
    expect(isJunkTranscript('Hello world')).toBe(false);
    expect(isJunkTranscript('我们要感谢客户的信任，继续推进项目')).toBe(false);
    expect(isJunkTranscript('Thank you for the introduction, let me answer that')).toBe(false);
  });
});
