// A piano system crop with pitch guides on both staves: treble names on the upper staff's lines and spaces (and ledgers),
// bass names on the lower's. Usage: swift pitchguide2.swift page.png out.png x0 x1 upperTop lowerTop spacing [scaleWidth]
import Foundation
import AppKit
let a = CommandLine.arguments
let img = NSImage(contentsOfFile: a[1])!, cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil)!
let x0 = Int(a[3])!, x1 = Int(a[4])!, ut = Double(a[5])!, lt = Double(a[6])!, sp = Double(a[7])!
let outW = a.count > 8 ? Double(a[8])! : Double(x1 - x0)
let y0 = Int(ut - 6 * sp), y1 = Int(lt + 10 * sp), w = x1 - x0, h = y1 - y0
let sc = outW / Double(w), W = Int(Double(w) * sc) + 140, H = Int(Double(h) * sc)
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: W, pixelsHigh: H, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
NSColor.white.setFill(); NSRect(x: 0, y: 0, width: W, height: H).fill()
NSGraphicsContext.current!.cgContext.draw(cg.cropping(to: CGRect(x: x0, y: y0, width: w, height: h))!, in: CGRect(x: 70, y: 0, width: Double(w) * sc, height: Double(H)))
let names = ["C", "D", "E", "F", "G", "A", "B"]
func guide(_ top: Double, _ ts: Int, _ to: Int, _ from: Int, _ to2: Int) {
    for k in from...to2 {
        let y = top + Double(k) * sp / 2, yy = Double(H) - (y - Double(y0)) * sc
        if yy < 0 || yy > Double(H) { continue }
        let idx = ts - k, nm = names[((idx % 7) + 7) % 7] + String(to + Int(floor(Double(idx) / 7)))
        let on = k % 2 == 0
        (on ? NSColor(calibratedRed: 1, green: 0, blue: 0, alpha: 0.35) : NSColor(calibratedRed: 0, green: 0.4, blue: 1, alpha: 0.3)).setStroke()
        let p = NSBezierPath(); p.move(to: NSPoint(x: 70, y: yy)); p.line(to: NSPoint(x: 70 + Double(w) * sc, y: yy)); p.lineWidth = 1; p.stroke()
        let at: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: max(9, sp * sc * 0.42)), .foregroundColor: on ? NSColor.red : NSColor.blue]
        (nm as NSString).draw(at: NSPoint(x: on ? 2 : 34, y: yy - 6), withAttributes: at)
        (nm as NSString).draw(at: NSPoint(x: 74 + Double(w) * sc, y: yy - 6), withAttributes: at)
    }
}
guide(ut, 3, 5, -9, 14)
guide(lt, 5, 3, -6, 15)
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[2]))
