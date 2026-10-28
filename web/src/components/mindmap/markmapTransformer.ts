import { Transformer } from 'markmap-lib';

/**
 * markmap's Transformer, with raw HTML in the markdown rendered as text. markmap-lib turns markdown-it's
 * `html` option on, and a mind map is not always ours: a public share's mind map is whatever its creator
 * posted, so `<img onerror=…>` or a fake sign-in overlay rendered as markup on toto-study.com. Formatting
 * (bold, links, code, KaTeX) is markdown and unaffected.
 */
export function createMarkmapTransformer(): Transformer {
  const transformer = new Transformer();
  transformer.md.set({ html: false });
  return transformer;
}
