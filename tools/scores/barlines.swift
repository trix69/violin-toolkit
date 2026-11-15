// Barlines of one staff: columns dark from the top line to the bottom line (and not much beyond, so stems are excluded
// unless they stop exactly there). Usage: swift barlines.swift page.png topLineY spacing [x0 x1]
import Foundation
import AppKit
let a = CommandLine.arguments
guard a.count >= 4, let img = NSImage(contentsOfFile: a[1]), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("usage"); exit(1) }
let top = Int(Double(a[2])!), sp = Double(a[3])!, w = cg.width, h = cg.height
let x0 = a.count > 4 ? Int(a[4])! : 0, x1 = a.count > 5 ? Int(a[5])! : w
var px = [UInt8](repeating: 0, count: w * h)
let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
let bot = top + Int(4 * sp)
var xs: [Int] = []
for x in x0..<min(x1, w) {
    var ok = true
    for y in top...bot where px[y * w + x] >= 128 { ok = false; break }
    if !ok { continue }
    // not a stem: clear a little above and below the staff (stems extend 3+ spaces beyond the head)
    let above = (1...Int(sp * 1.2)).filter { px[(top - $0) * w + x] < 128 }.count, below = (1...Int(sp * 1.2)).filter { px[(bot + $0) * w + x] < 128 }.count
    if above > Int(sp * 0.8) || below > Int(sp * 0.8) { continue }
    if let l = xs.last, x - l <= 3 { continue }
    xs.append(x)
}
print(xs.map(String.init).joined(separator: " "))
