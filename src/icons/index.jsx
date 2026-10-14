import React from 'react'

function toKebab(str) {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

function toPascal(str) {
  return str.replace(/^([A-Z])|[\s-_]+(\w)/g, (_, a, b) => b ? b.toUpperCase() : a.toLowerCase())
}

function toTitle(str) {
  return toPascal(str).charAt(0).toUpperCase() + toPascal(str).slice(1)
}

const defaultAttrs = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24, height: 24, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round'
}

const Icon = React.forwardRef(({ color = 'currentColor', size = 24, strokeWidth = 2, absoluteStrokeWidth, className = '', children, iconNode, ...props }, ref) =>
  React.createElement('svg', {
    ref, ...defaultAttrs,
    width: size, height: size,
    stroke: color,
    strokeWidth: absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
    className: ['lucide', className].filter(Boolean).join(' ').trim(),
    ...(!children && !['aria-', 'role', 'title'].some(a => a.startsWith('aria-') ? Object.keys(props).some(k => k.startsWith('aria-')) : props[a]) && { 'aria-hidden': 'true' }),
    ...props
  }, [...iconNode.map(([tag, attrs]) => React.createElement(tag, attrs)), ...(Array.isArray(children) ? children : [children])])
)

function createIcon(name, iconNode) {
  const Comp = React.forwardRef(({ className, ...props }, ref) =>
    React.createElement(Icon, { ref, iconNode, className: `lucide-${toKebab(toTitle(name))} lucide-${name} ${className || ''}`.trim(), ...props })
  )
  Comp.displayName = toTitle(name)
  return Comp
}

export const Check = createIcon('check', [['path', { d: 'M20 6 9 17l-5-5', key: '1gmf2c' }]])
export const ChevronRight = createIcon('chevron-right', [['path', { d: 'm9 18 6-6-6-6', key: 'mthhwq' }]])
export const Clock = createIcon('clock', [
  ['path', { d: 'M12 6v6l4 2', key: 'mmk7yg' }],
  ['circle', { cx: '12', cy: '12', r: '10', key: '1mglay' }]
])
export const Copy = createIcon('copy', [
  ['rect', { width: '14', height: '14', x: '8', y: '8', rx: '2', ry: '2', key: '17jyea' }],
  ['path', { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2', key: 'zix9uf' }]
])
export const CreditCard = createIcon('credit-card', [
  ['rect', { width: '20', height: '14', x: '2', y: '5', rx: '2', key: 'ynyp8z' }],
  ['line', { x1: '2', x2: '22', y1: '10', y2: '10', key: '1b3vmo' }]
])
export const EllipsisVertical = createIcon('ellipsis-vertical', [
  ['circle', { cx: '12', cy: '12', r: '1', key: '41hilf' }],
  ['circle', { cx: '12', cy: '5', r: '1', key: 'gxeob9' }],
  ['circle', { cx: '12', cy: '19', r: '1', key: 'lyex9k' }]
])
export const EyeOff = createIcon('eye-off', [
  ['path', { d: 'M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49', key: 'ct8e1f' }],
  ['path', { d: 'M14.084 14.158a3 3 0 0 1-4.242-4.242', key: '151rxh' }],
  ['path', { d: 'M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143', key: '13bj9a' }],
  ['path', { d: 'm2 2 20 20', key: '1ooewy' }]
])
export const Eye = createIcon('eye', [
  ['path', { d: 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0', key: '1nclc0' }],
  ['circle', { cx: '12', cy: '12', r: '3', key: '1v7zrd' }]
])
export const FileSearch = createIcon('file-search', [
  ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4', key: 'tnqrlb' }],
  ['path', { d: 'M4.268 21a2 2 0 0 0 1.727 1H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3', key: 'ms7g94' }],
  ['path', { d: 'm9 18-1.5-1.5', key: '1j6qii' }],
  ['circle', { cx: '5', cy: '14', r: '3', key: 'ufru5t' }]
])
export const IndianRupee = createIcon('indian-rupee', [
  ['path', { d: 'M6 3h12', key: 'ggurg9' }],
  ['path', { d: 'M6 8h12', key: '6g4wlu' }],
  ['path', { d: 'm6 13 8.5 8', key: 'u1kupk' }],
  ['path', { d: 'M6 13h3', key: 'wdp6ag' }],
  ['path', { d: 'M9 13c6.667 0 6.667-10 0-10', key: '1nkvk2' }]
])
export const Link = createIcon('link', [
  ['path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', key: '1cjeqo' }],
  ['path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71', key: '19qd67' }]
])
export const LogOut = createIcon('log-out', [
  ['path', { d: 'm16 17 5-5-5-5', key: '1bji2h' }],
  ['path', { d: 'M21 12H9', key: 'dn1m92' }],
  ['path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', key: '1uf3rs' }]
])
export const MessageSquare = createIcon('message-square', [
  ['path', { d: 'M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z', key: '18887p' }]
])
export const Phone = createIcon('phone', [
  ['path', { d: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384', key: '9njp5v' }]
])
export const Plus = createIcon('plus', [
  ['path', { d: 'M5 12h14', key: '1ays0h' }],
  ['path', { d: 'M12 5v14', key: 's699le' }]
])
export const RefreshCw = createIcon('refresh-cw', [
  ['path', { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', key: 'v9h5vc' }],
  ['path', { d: 'M21 3v5h-5', key: '1q7to0' }],
  ['path', { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16', key: '3uifl3' }],
  ['path', { d: 'M8 16H3v5', key: '1cv678' }]
])
export const Search = createIcon('search', [
  ['path', { d: 'm21 21-4.34-4.34', key: '14j7rj' }],
  ['circle', { cx: '11', cy: '11', r: '8', key: '4ej97u' }]
])
export const Send = createIcon('send', [
  ['path', { d: 'M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z', key: '1ffxy3' }],
  ['path', { d: 'm21.854 2.147-10.94 10.939', key: '12cjpa' }]
])
export const Share2 = createIcon('share-2', [
  ['circle', { cx: '18', cy: '5', r: '3', key: 'gq8acd' }],
  ['circle', { cx: '6', cy: '12', r: '3', key: 'w7nqdw' }],
  ['circle', { cx: '18', cy: '19', r: '3', key: '1xt0gg' }],
  ['line', { x1: '8.59', x2: '15.42', y1: '13.51', y2: '17.49', key: '47mynk' }],
  ['line', { x1: '15.41', x2: '8.59', y1: '6.51', y2: '10.49', key: '1n3mei' }]
])
export const Shield = createIcon('shield', [
  ['path', { d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', key: 'oel41y' }]
])
export const Signal = createIcon('signal', [
  ['path', { d: 'M2 20h.01', key: '4haj6o' }],
  ['path', { d: 'M7 20v-4', key: 'j294jx' }],
  ['path', { d: 'M12 20v-8', key: 'i3yub9' }],
  ['path', { d: 'M17 20V8', key: '1tkaf5' }],
  ['path', { d: 'M22 4v16', key: 'sih9yq' }]
])
export const Trash2 = createIcon('trash-2', [
  ['path', { d: 'M10 11v6', key: 'nco0om' }],
  ['path', { d: 'M14 11v6', key: 'outv1u' }],
  ['path', { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', key: 'miytrc' }],
  ['path', { d: 'M3 6h18', key: 'd0wm0j' }],
  ['path', { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', key: 'e791ji' }]
])
export const TrendingDown = createIcon('trending-down', [
  ['path', { d: 'M16 17h6v-6', key: 't6n2it' }],
  ['path', { d: 'm22 17-8.5-8.5-5 5L2 7', key: 'x473p' }]
])
export const TrendingUp = createIcon('trending-up', [
  ['path', { d: 'M16 7h6v6', key: 'box55l' }],
  ['path', { d: 'm22 7-8.5 8.5-5-5L2 17', key: '1t1m79' }]
])
export const TriangleAlert = createIcon('triangle-alert', [
  ['path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3', key: 'wmoenq' }],
  ['path', { d: 'M12 9v4', key: 'juzpu7' }],
  ['path', { d: 'M12 17h.01', key: 'p32p05' }]
])
export const Upload = createIcon('upload', [
  ['path', { d: 'M12 3v12', key: '1x0j5s' }],
  ['path', { d: 'm17 8-5-5-5 5', key: '7q97r8' }],
  ['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', key: 'ih7n3h' }]
])
export const Wifi = createIcon('wifi', [
  ['path', { d: 'M12 20h.01', key: 'zekei9' }],
  ['path', { d: 'M2 8.82a15 15 0 0 1 20 0', key: 'dnpr2z' }],
  ['path', { d: 'M5 12.859a10 10 0 0 1 14 0', key: '1x1e6c' }],
  ['path', { d: 'M8.5 16.429a5 5 0 0 1 7 0', key: '1bycff' }]
])
export const X = createIcon('x', [
  ['path', { d: 'M18 6 6 18', key: '1bl5f8' }],
  ['path', { d: 'm6 6 12 12', key: 'd8bk6v' }]
])
export const Zap = createIcon('zap', [
  ['path', { d: 'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z', key: '1xq2db' }]
])
export const SendHorizontal = createIcon('send-horizontal', [
  ['path', { d: 'M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z', key: '18uepv' }]
])
export const Pin = createIcon('pin', [
  ['path', { d: 'M12 17v5', key: '1ifn8i' }],
  ['path', { d: 'M9 10.76a2 2 0 0 1-1.11 1.79l-.81.42A2 2 0 0 0 6 14.68V17h12v-2.32a2 2 0 0 0-1.08-1.71l-.81-.42A2 2 0 0 1 15 10.76V6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1z', key: '1jq6xp' }],
  ['path', { d: 'M8 3v3', key: '1c6mvf' }],
  ['path', { d: 'M16 3v3', key: '1qv75r' }]
])
export const StickyNote = createIcon('sticky-note', [
  ['path', { d: 'M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z', key: '1d3xrc' }],
  ['path', { d: 'M15 3v4a2 2 0 0 0 2 2h4', key: '1s8h2t' }]
])
export const Bot = createIcon('bot', [
  ['path', { d: 'M12 8V4H8', key: 'hb1lq9' }],
  ['rect', { width: '16', height: '12', x: '4', y: '8', rx: '2', key: '1z6kjd' }],
  ['path', { d: 'M2 14h2', key: 'dv0y3d' }],
  ['path', { d: 'M20 14h2', key: '1g80o' }],
  ['path', { d: 'M15 13v2', key: '1xmb7q' }],
  ['path', { d: 'M9 13v2', key: '1n82fn' }]
])
