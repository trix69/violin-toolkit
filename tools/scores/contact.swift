// Contact sheet: top parts of PDF pages in a grid, numbered. Usage: swift contact.swift in.pdf out.png first last [cols] [cropFraction]
import Foundation
import PDFKit
import AppKit
let a = CommandLine.arguments
let doc = PDFDocument(url: URL(fileURLWithPath: a[1]))!
let first = Int(a[3])!, last = min(Int(a[4])!, doc.pageCount), cols = a.count > 5 ? Int(a[5])! : 6
let frac = a.count > 6 ? CGFloat(Double(a[6])!) : 0.3
let tw: CGFloat = 330, n = last - first + 1, rows = (n + cols - 1) / cols
let pg0 = doc.page(at: first - 1)!.bounds(for: .mediaBox)
let th = tw * pg0.height / pg0.width * frac
let W = tw * CGFloat(cols), H = (th + 18) * CGFloat(rows)
let img = NSImage(size: NSSize(width: W, height: H))
img.lockFocus()
NSColor.white.setFill(); NSRect(x: 0, y: 0, width: W, height: H).fill()
for i in first...last {
    let k = i - first, c = k % cols, r = k / cols
    guard let pg = doc.page(at: i - 1) else { continue }
    let full = pg.thumbnail(of: NSSize(width: tw, height: tw * pg0.height / pg0.width), for: .mediaBox)
    let src = NSRect(x: 0, y: full.size.height * (1 - frac), width: tw, height: full.size.height * frac)
    let y = H - CGFloat(r + 1) * (th + 18)
    full.draw(in: NSRect(x: CGFloat(c) * tw, y: y, width: tw, height: th), from: src, operation: .sourceOver, fraction: 1)
    ("p\(i)" as NSString).draw(at: NSPoint(x: CGFloat(c) * tw + 4, y: y + th + 2), withAttributes: [.font: NSFont.boldSystemFont(ofSize: 13), .foregroundColor: NSColor.red])
}
img.unlockFocus()
let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[2]))
