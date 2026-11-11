import Foundation
import PDFKit
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else {
    fputs("Usage: swift render_pages.swift <input.pdf> <preview_dir> [--cover-out <cover.png>] [--cover-only]\n", stderr)
    exit(1)
}

let pdfURL = URL(fileURLWithPath: args[1])
let outDir = URL(fileURLWithPath: args[2])

var coverOutPath: String? = nil
var coverOnly = false

var idx = 3
while idx < args.count {
    if args[idx] == "--cover-out", idx + 1 < args.count {
        coverOutPath = args[idx + 1]
        idx += 2
    } else if args[idx] == "--cover-only" {
        coverOnly = true
        idx += 1
    } else {
        idx += 1
    }
}

guard let doc = PDFDocument(url: pdfURL) else {
    fputs("Failed to open PDF at \(pdfURL.path)\n", stderr)
    exit(1)
}

print("Total pages: \(doc.pageCount)")

func renderPage(_ page: PDFPage, targetWidth: Int) -> Data? {
    let bounds = page.bounds(for: .mediaBox)
    let scale = CGFloat(targetWidth) / bounds.width
    let height = Int((bounds.height * scale).rounded())

    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: targetWidth,
        pixelsHigh: height,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else { return nil }

    NSGraphicsContext.saveGraphicsState()
    if let ctx = NSGraphicsContext(bitmapImageRep: rep) {
        NSGraphicsContext.current = ctx
        let cg = ctx.cgContext
        cg.interpolationQuality = .high
        cg.setFillColor(NSColor.white.cgColor)
        cg.fill(CGRect(x: 0, y: 0, width: targetWidth, height: height))
        cg.scaleBy(x: scale, y: scale)
        page.draw(with: .mediaBox, to: cg)
    }
    NSGraphicsContext.restoreGraphicsState()

    return rep.representation(using: .png, properties: [:])
}

if let coverPath = coverOutPath, let firstPage = doc.page(at: 0) {
    let coverURL = URL(fileURLWithPath: coverPath)
    try? FileManager.default.createDirectory(at: coverURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    if let data = renderPage(firstPage, targetWidth: 480) {
        try data.write(to: coverURL)
        print("Rendered cover thumbnail \(coverURL.path)")
    }
}

if !coverOnly {
    try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)
    for i in 0..<doc.pageCount {
        guard let page = doc.page(at: i) else { continue }
        let bounds = page.bounds(for: .mediaBox)
        let targetWidth = Int(bounds.width * 2.0)
        if let data = renderPage(page, targetWidth: targetWidth) {
            let outFile = outDir.appendingPathComponent(String(format: "page_%02d.png", i + 1))
            try data.write(to: outFile)
            print("Rendered \(outFile.path)")
        }
    }
}
