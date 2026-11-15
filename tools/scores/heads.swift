// Noteheads on one staff, measured from the pixels: in each column the dark runs about one staff space tall are head
// candidates (stems and beams are too long or too thin); neighbouring columns with such a run at the same height make a head
// when they span at least ~0.9 space. Prints each head's x, centre y and pitch name (no accidentals: the key or a sign adds them).
// Usage: swift heads.swift page.png topLineY spacing clef(G|F) x0 x1 [minWidthFactor 0.9]
import Foundation
import AppKit

let a = CommandLine.arguments
guard a.count >= 7, let img = NSImage(contentsOfFile: a[1]), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("usage"); exit(1) }
let top = Double(a[2])!, sp = Double(a[3])!, clef = a[4], x0 = Int(a[5])!, x1 = Int(a[6])!, minW = a.count > 7 ? Double(a[7])! : 0.9
let w = cg.width, h = cg.height
var px = [UInt8](repeating: 0, count: w * h)
let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
let dark = { (x: Int, y: Int) -> Bool in px[y * w + x] < 110 }
let names = ["C", "D", "E", "F", "G", "A", "B"]
let (topStep, topOct) = clef == "G" ? (3, 5) : (5, 3)
func pitch(_ y: Double) -> String {
    let k = Int((y - top) / (sp / 2)).signum() * Int((abs(y - top) / (sp / 2)).rounded())
    let idx = topStep - k, st = ((idx % 7) + 7) % 7, oc = topOct + Int(floor(Double(idx) / 7.0))
    return names[st] + String(oc)
}
// staff lines (and ledger lines) are thin: a run shorter than 0.35 space is a line, not a head
let yLo = max(0, Int(top - 7 * sp)), yHi = min(h - 1, Int(top + 11 * sp))
var cand: [(x: Int, c: Double)] = []
for x in x0..<min(x1, w) {
    var y = yLo
    while y < yHi {
        if dark(x, y) {
            var e = y; while e < yHi && dark(x, e) { e += 1 }
            let len = Double(e - y)
            if len >= 0.6 * sp && len <= 1.35 * sp { cand.append((x, Double(y + e) / 2)) }
            y = e
        } else { y += 1 }
    }
}
// group: same centre (within 0.3 space), consecutive columns
var groups: [(x0: Int, x1: Int, ys: [Double])] = []
for c in cand {
    if let i = groups.lastIndex(where: { c.x - $0.x1 <= 2 && abs(($0.ys.reduce(0, +) / Double($0.ys.count)) - c.c) < 0.3 * sp }) {
        groups[i].x1 = c.x; groups[i].ys.append(c.c)
    } else { groups.append((c.x, c.x, [c.c])) }
}
let heads = groups.filter { Double($0.x1 - $0.x0) >= minW * sp }.sorted { $0.x0 < $1.x0 }
for g in heads {
    let cy = g.ys.reduce(0, +) / Double(g.ys.count)
    print(String(format: "x %4d-%4d  y %6.1f  %@  (%+.2f steps)", g.x0, g.x1, cy, pitch(cy), (top - cy) / (sp / 2)))
}
