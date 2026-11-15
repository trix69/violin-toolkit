// Barlines of a piano system: columns dark all the way from the upper staff's top line to the lower staff's bottom line.
// Usage: swift sysbars.swift page.png upperTopY lowerTopY spacing
import Foundation
import AppKit
let a = CommandLine.arguments
let img = NSImage(contentsOfFile: a[1])!, cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil)!
let t = Int(a[2])!, l = Int(a[3])!, sp = Double(a[4])!, w = cg.width, h = cg.height
var px = [UInt8](repeating: 0, count: w * h)
CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue)!.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
let b = l + Int(4 * sp); var xs: [Int] = []
for x in 0..<w {
    var miss = 0
    for y in t...b where px[y * w + x] >= 128 { miss += 1 }
    if miss <= Int(sp * 0.3) { if let p = xs.last, x - p < 20 { continue }; xs.append(x) }
}
print(xs.map(String.init).joined(separator: " "))
