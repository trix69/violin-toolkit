// Crop of a staff with a pitch guide: every line and space (and ledger positions) marked with a thin coloured line and its
// note name at both edges, so chord heads can be read exactly. Usage:
// swift pitchguide.swift page.png out.png x0 x1 topLineY spacing clef(G|F) [ledgers 4]
import Foundation
import AppKit

let a = CommandLine.arguments
guard a.count >= 8, let img = NSImage(contentsOfFile: a[1]), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("usage"); exit(1) }
let x0 = Int(a[3])!, x1 = Int(a[4])!, top = Double(a[5])!, sp = Double(a[6])!, clef = a[7], led = a.count > 8 ? Int(a[8])! : 4
let names = ["C", "D", "E", "F", "G", "A", "B"]
// the top line's pitch: G clef F5 (step 3, octave 5), F clef A3 (step 5, octave 3)
let (topStep, topOct) = clef == "G" ? (3, 5) : (5, 3)
let half = sp / 2
let y0 = max(0, Int(top - Double(led + 1) * sp)), y1 = min(cg.height, Int(top + 4 * sp + Double(led + 1) * sp))
let w = x1 - x0, h = y1 - y0
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: w + 120, pixelsHigh: h, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSColor.white.setFill(); NSRect(x: 0, y: 0, width: w + 120, height: h).fill()
let src = cg.cropping(to: CGRect(x: x0, y: y0, width: w, height: h))!
NSGraphicsContext.current!.cgContext.draw(src, in: CGRect(x: 60, y: 0, width: w, height: h))
var k = -2 * (led + 1)
while true {
    let y = top + Double(k) * half
    if y > Double(y1) { break }
    if y >= Double(y0) {
        let idx = topStep - k, st = ((idx % 7) + 7) % 7, oc = topOct + Int(floor(Double(idx) / 7.0))
        let label = names[st] + String(oc)
        let yy = Double(h) - (y - Double(y0))
        let onLine = k % 2 == 0
        (onLine ? NSColor(calibratedRed: 1, green: 0, blue: 0, alpha: 0.35) : NSColor(calibratedRed: 0, green: 0.4, blue: 1, alpha: 0.30)).setStroke()
        let p = NSBezierPath(); p.move(to: NSPoint(x: 60, y: yy)); p.line(to: NSPoint(x: 60 + Double(w), y: yy)); p.lineWidth = 1; p.stroke()
        let at: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: max(9, half * 0.9)), .foregroundColor: onLine ? NSColor.red : NSColor.blue]
        (label as NSString).draw(at: NSPoint(x: onLine ? 2 : 30, y: yy - half * 0.5), withAttributes: at)
        (label as NSString).draw(at: NSPoint(x: 64 + Double(w), y: yy - half * 0.5), withAttributes: at)
    }
    k += 1
}
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[2]))
print("wrote", a[2], w + 120, "x", h)
