// Render PDF pages to PNG with PDFKit. Usage: swift pdfpng.swift in.pdf outprefix firstPage lastPage [widthPx]
import Foundation
import PDFKit
import AppKit

let a = CommandLine.arguments
guard a.count >= 5, let doc = PDFDocument(url: URL(fileURLWithPath: a[1])) else { print("usage / cannot open"); exit(1) }
let first = Int(a[3])!, last = min(Int(a[4])!, doc.pageCount), W = a.count > 5 ? CGFloat(Double(a[5])!) : 1600
print("pages", doc.pageCount)
for i in first...last {
    guard let pg = doc.page(at: i - 1) else { continue }
    let box = pg.bounds(for: .mediaBox), s = W / box.width
    let size = NSSize(width: box.width * s, height: box.height * s)
    let img = pg.thumbnail(of: size, for: .mediaBox)
    guard let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) else { continue }
    try! png.write(to: URL(fileURLWithPath: "\(a[2])-\(String(format: "%02d", i)).png"))
}
