/**
 * A deliberately small, dependency-free syntax highlighter.
 *
 * The document viewer accepts ~120 source extensions, so per-language grammars
 * are not worth their weight here — every language in that list is covered by
 * one generic tokenizer driven by a per-family spec (what starts a comment,
 * what quotes a string, which words are keywords). The output is good enough to
 * read code by; it is not an editor, and it never tries to parse structure.
 */

export type TokenKind = 'comment' | 'string' | 'number' | 'keyword' | 'plain';

export interface Token {
  text: string;
  kind: TokenKind;
}

interface StringSpec {
  open: string;
  close: string;
  /** Whether a backslash escapes the closing delimiter. */
  escape: boolean;
}

interface LanguageSpec {
  label: string;
  lineComments: string[];
  blockComments: [open: string, close: string][];
  strings: StringSpec[];
  keywords: Set<string>;
}

const words = (list: string): Set<string> => new Set(list.split(/\s+/).filter(Boolean));

// One broad keyword union per family. A word that is a keyword in a sibling
// language costs nothing here — it is still a word worth highlighting.
const C_KEYWORDS = words(`
  abstract as async await break case catch class const constexpr continue decltype default defer
  delete do else enum export extends extern final finally for friend func function go goto if impl
  implements import in inline instanceof interface internal is let match mod module mut namespace
  new nil null operator override package private protected public pub readonly record return sealed
  select sizeof static struct super switch template this throw throws trait try type typedef typeof
  typename union unsafe use using var virtual void volatile when where while with yield
  bool boolean byte char double float int long short signed string unsigned rune error any never
  true false undefined NULL nullptr self val fun suspend lateinit companion data object init
`);

const SCRIPT_KEYWORDS = words(`
  and as assert async await begin break case class continue def defined del do each elif else elsif
  end ensure except exec export extends false finally for from function global if import in is lambda
  let local module next nil none nonlocal not or pass proc puts raise redo require rescue retry
  return self then throw true try unless until use when while with yield
  echo fi esac then do done local export readonly source set unset shift trap alias declare typeset
  None True False print len range str int float list dict set tuple
`);

const LISP_KEYWORDS = words(`
  def defn defmacro defmethod defprotocol defrecord defstruct deftype defvar defparameter defun
  let let* letfn fn lambda if when unless cond case do doseq dotimes loop recur quote require ns
  import use setq setf progn and or not nil t true false
`);

const SQL_KEYWORDS = words(`
  add all alter and as asc begin between by case cast check column commit constraint create cross
  cursor database default delete desc distinct drop else end exists foreign from full group having
  if in index inner insert into is join key left like limit not null offset on or order outer
  primary references right rollback select set table then transaction union unique update values
  view when where with
`);

const C_LIKE: LanguageSpec = {
  label: 'code',
  lineComments: ['//'],
  blockComments: [['/*', '*/']],
  strings: [
    { open: '"', close: '"', escape: true },
    { open: "'", close: "'", escape: true },
    { open: '`', close: '`', escape: true },
  ],
  keywords: C_KEYWORDS,
};

const SPECS: Record<string, LanguageSpec> = {
  c: C_LIKE,
  script: {
    label: 'script',
    lineComments: ['#'],
    blockComments: [['"""', '"""'], ["'''", "'''"], ['=begin', '=end']],
    strings: [
      { open: '"', close: '"', escape: true },
      { open: "'", close: "'", escape: true },
    ],
    keywords: SCRIPT_KEYWORDS,
  },
  lisp: {
    label: 'lisp',
    lineComments: [';'],
    blockComments: [],
    strings: [{ open: '"', close: '"', escape: true }],
    keywords: LISP_KEYWORDS,
  },
  sql: {
    label: 'sql',
    lineComments: ['--'],
    blockComments: [['/*', '*/']],
    strings: [
      { open: "'", close: "'", escape: true },
      { open: '"', close: '"', escape: true },
    ],
    keywords: SQL_KEYWORDS,
  },
  lua: {
    label: 'lua',
    lineComments: ['--'],
    blockComments: [['--[[', ']]']],
    strings: [
      { open: '"', close: '"', escape: true },
      { open: "'", close: "'", escape: true },
    ],
    keywords: words(`
      and break do else elseif end false for function goto if in local nil not or repeat return
      then true until while self
    `),
  },
  haskell: {
    label: 'haskell',
    lineComments: ['--'],
    blockComments: [['{-', '-}']],
    strings: [{ open: '"', close: '"', escape: true }],
    keywords: words(`
      case class data default deriving do else foreign if import in infix infixl infixr instance let
      module newtype of then type where forall
    `),
  },
  markup: {
    label: 'markup',
    lineComments: [],
    blockComments: [['<!--', '-->']],
    strings: [
      { open: '"', close: '"', escape: false },
      { open: "'", close: "'", escape: false },
    ],
    keywords: new Set<string>(),
  },
  css: {
    label: 'css',
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { open: '"', close: '"', escape: true },
      { open: "'", close: "'", escape: true },
    ],
    keywords: words(`
      import media supports keyframes from to and not only screen print include mixin extend use
      forward function return if else each for while charset font-face namespace
    `),
  },
  json: {
    label: 'json',
    lineComments: [],
    blockComments: [],
    strings: [{ open: '"', close: '"', escape: true }],
    keywords: words('true false null'),
  },
  jsonc: {
    label: 'json',
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: [
      { open: '"', close: '"', escape: true },
      { open: "'", close: "'", escape: true },
    ],
    keywords: words('true false null undefined Infinity NaN'),
  },
  ini: {
    label: 'config',
    lineComments: [';', '#'],
    blockComments: [],
    strings: [
      { open: '"', close: '"', escape: true },
      { open: "'", close: "'", escape: true },
    ],
    keywords: words('true false yes no on off null none'),
  },
  tex: {
    label: 'tex',
    lineComments: ['%'],
    blockComments: [],
    strings: [],
    keywords: words(`
      begin end documentclass usepackage section subsection subsubsection chapter paragraph item
      textbf textit emph label ref cite includegraphics newcommand renewcommand frac sum int left right
    `),
  },
  percent: {
    label: 'code',
    // .m is MATLAB (%) far more often than Objective-C (//); accepting both
    // costs nothing and keeps either file readable.
    lineComments: ['%', '//'],
    blockComments: [['%{', '%}'], ['/*', '*/']],
    strings: [
      { open: '"', close: '"', escape: true },
      { open: "'", close: "'", escape: true },
    ],
    keywords: words(`
      function end if elseif else for while switch case otherwise break continue return global
      persistent try catch classdef properties methods events arguments import
    `),
  },
  fortran: {
    label: 'fortran',
    lineComments: ['!'],
    blockComments: [],
    strings: [
      { open: "'", close: "'", escape: false },
      { open: '"', close: '"', escape: false },
    ],
    keywords: words(`
      program end subroutine function module use implicit none integer real complex logical character
      dimension parameter allocate deallocate if then else endif do while call return contains type
      intent in out inout print write read stop
    `),
  },
  vb: {
    label: 'basic',
    lineComments: ["'"],
    blockComments: [],
    strings: [{ open: '"', close: '"', escape: false }],
    keywords: words(`
      dim as if then else elseif end sub function for each next while wend do loop select case
      public private protected friend shared static new class module structure enum interface
      implements inherits imports namespace try catch finally throw return true false nothing
    `),
  },
  batch: {
    label: 'batch',
    lineComments: ['rem ', 'REM ', '::'],
    blockComments: [],
    strings: [{ open: '"', close: '"', escape: false }],
    keywords: words(`
      echo set call goto if else exist errorlevel for in do not defined start pause exit setlocal
      endlocal shift title cd dir copy move del
    `),
  },
  vim: {
    label: 'vim',
    lineComments: ['"'],
    blockComments: [],
    strings: [{ open: "'", close: "'", escape: false }],
    keywords: words(`
      function endfunction if elseif else endif for endfor while endwhile try catch endtry let set
      setlocal call return au autocmd augroup nnoremap inoremap vnoremap map command source echo
    `),
  },
};

const EXTENSION_SPECS: Record<string, keyof typeof SPECS> = {};

const assign = (family: keyof typeof SPECS, extensions: string) => {
  for (const ext of extensions.split(/\s+/).filter(Boolean)) EXTENSION_SPECS[ext] = family;
};

assign('c', `
  js jsx mjs cjs ts tsx mts cts vue svelte astro java kt kts scala sbt groovy gradle c h cpp cc cxx
  hpp hh hxx cs go rs swift dart php phtml sol zig d ino fs fsx proto graphql gql avsc edn ml mli
  pas hcl tf tfvars slim
`);
assign('script', `
  py pyi rb rake gemspec sh bash zsh fish ps1 psm1 awk r jl pl pm nim ex exs erl hrl yaml yml toml
  properties conf cmake mk nix coffee dockerfile jinja j2 twig liquid hbs mustache erb ejs pug haml
`);
assign('lisp', 'clj cljs cljc scm rkt lisp el tcl');
assign('sql', 'sql');
assign('lua', 'lua');
assign('haskell', 'hs elm');
assign('markup', 'html htm xhtml xml plist opml rss atom svg ttml dfxp');
assign('css', 'css scss sass less styl');
assign('json', 'json jsonl ndjson');
assign('jsonc', 'jsonc json5');
assign('ini', 'ini cfg');
assign('tex', 'tex ltx sty cls bib bbl');
assign('percent', 'm mm');
assign('fortran', 'f90 f95 for');
assign('vb', 'vb');
assign('batch', 'bat cmd');
assign('vim', 'vim');

/** Files past this size render unhighlighted — tokenizing them janks the tab. */
export const HIGHLIGHT_SIZE_LIMIT = 400_000;

export const extensionOf = (fileName: string): string => {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
};

const specFor = (fileName: string): LanguageSpec =>
  SPECS[EXTENSION_SPECS[extensionOf(fileName)] ?? 'c'] ?? C_LIKE;

const isIdentifierStart = (ch: string) => /[A-Za-z_$@\\]/.test(ch);
const isIdentifierPart = (ch: string) => /[\w$-]/.test(ch);

/**
 * Splits source into flat tokens. Never throws and never drops input: the
 * concatenation of every token's text always equals the input exactly.
 */
export function tokenize(source: string, fileName: string): Token[] {
  const spec = specFor(fileName);
  const tokens: Token[] = [];
  let plain = '';

  const flush = () => {
    if (plain) {
      tokens.push({ text: plain, kind: 'plain' });
      plain = '';
    }
  };
  const push = (text: string, kind: TokenKind) => {
    flush();
    tokens.push({ text, kind });
  };

  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i, i + 8);

    const block = spec.blockComments.find(([open]) => rest.startsWith(open));
    if (block) {
      const [open, close] = block;
      const end = source.indexOf(close, i + open.length);
      const stop = end === -1 ? source.length : end + close.length;
      push(source.slice(i, stop), 'comment');
      i = stop;
      continue;
    }

    const lineComment = spec.lineComments.find(marker => rest.startsWith(marker));
    if (lineComment) {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      push(source.slice(i, stop), 'comment');
      i = stop;
      continue;
    }

    const string = spec.strings.find(s => rest.startsWith(s.open));
    if (string) {
      let j = i + string.open.length;
      while (j < source.length) {
        if (string.escape && source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source.startsWith(string.close, j)) {
          j += string.close.length;
          break;
        }
        // An unterminated single-line string ends at the newline, so one stray
        // apostrophe in a comment-free line cannot swallow the rest of the file.
        if (source[j] === '\n') break;
        j++;
      }
      push(source.slice(i, Math.min(j, source.length)), 'string');
      i = Math.min(j, source.length);
      continue;
    }

    const ch = source[i];
    if (/\d/.test(ch) && !isIdentifierPart(source[i - 1] ?? ' ')) {
      let j = i;
      while (j < source.length && /[\w.]/.test(source[j])) j++;
      push(source.slice(i, j), 'number');
      i = j;
      continue;
    }

    if (isIdentifierStart(ch)) {
      let j = i;
      while (j < source.length && isIdentifierPart(source[j])) j++;
      const word = source.slice(i, j);
      if (spec.keywords.has(word)) push(word, 'keyword');
      else plain += word;
      i = j;
      continue;
    }

    plain += ch;
    i++;
  }

  flush();
  return tokens;
}

/**
 * Tokens regrouped per line, which is what a line-numbered view needs — block
 * comments and multi-line strings are split at the newlines they span.
 */
export function tokenizeLines(source: string, fileName: string): Token[][] {
  // A file ending in a newline would otherwise show a phantom last line.
  const normalized = source.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  if (normalized.length > HIGHLIGHT_SIZE_LIMIT)
    return normalized.split('\n').map(line => [{ text: line, kind: 'plain' as const }]);

  const lines: Token[][] = [[]];
  for (const token of tokenize(normalized, fileName)) {
    const parts = token.text.split('\n');
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, kind: token.kind });
    });
  }
  return lines;
}
