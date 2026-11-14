// Staff lines of a page image: rows where most pixels are dark, grouped into staves of five.
// Usage: swift stafflines.swift page.png [darkFraction 0.45]
import Foundation
import AppKit

let a = CommandLine.arguments
guard a.count >= 2, let img = NSImage(contentsOfFile: a[1]), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("usage / cannot open"); exit(1) }
let frac = a.count > 2 ? Double(a[2])! : 0.45
let w = cg.width, h = cg.height
var px = [UInt8](repeating: 0, count: w * h)
let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
var lines: [Int] = []
var prev = -10
for y in 0..<h {
    var dark = 0
    for x in 0..<w where px[y * w + x] < 128 { dark += 1 }
    if Double(dark) / Double(w) > frac { if y - prev > 2 { lines.append(y) }; prev = y }
}
// group into staves: five lines with even spacing
var staves: [[Int]] = []; var cur: [Int] = []
for y in lines {
    if let l = cur.last, y - l > 40 { if cur.count >= 5 { staves.append(cur) }; cur = [] }
    cur.append(y)
}
if cur.count >= 5 { staves.append(cur) }
print("\(w)x\(h), \(lines.count) lines, \(staves.count) staves")
for (i, s) in staves.enumerated() { print("staff \(i + 1): \(s.map(String.init).joined(separator: " "))") }
