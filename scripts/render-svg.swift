import AppKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

guard CommandLine.arguments.count == 4 else {
  fputs("Usage: render-svg <input.svg> <output.png> <size>\n", stderr)
  exit(64)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])

guard let size = Int(CommandLine.arguments[3]), size > 0 else {
  fputs("Size must be a positive integer.\n", stderr)
  exit(64)
}

guard let image = NSImage(contentsOf: inputURL) else {
  fputs("Could not decode SVG at \(inputURL.path).\n", stderr)
  exit(65)
}

let colorSpace = CGColorSpaceCreateDeviceRGB()
let bitmapInfo = CGBitmapInfo.byteOrder32Big.union(
  CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue)
)

guard let context = CGContext(
  data: nil,
  width: size,
  height: size,
  bitsPerComponent: 8,
  bytesPerRow: size * 4,
  space: colorSpace,
  bitmapInfo: bitmapInfo.rawValue
) else {
  fputs("Could not allocate the output canvas.\n", stderr)
  exit(70)
}

context.setFillColor(
  NSColor(red: 244 / 255, green: 240 / 255, blue: 232 / 255, alpha: 1).cgColor
)
context.fill(CGRect(x: 0, y: 0, width: size, height: size))

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
image.draw(
  in: NSRect(x: 0, y: 0, width: size, height: size),
  from: .zero,
  operation: .copy,
  fraction: 1
)
NSGraphicsContext.restoreGraphicsState()

guard let renderedImage = context.makeImage() else {
  fputs("Could not create the rendered image.\n", stderr)
  exit(70)
}

guard let destination = CGImageDestinationCreateWithURL(
  outputURL as CFURL,
  UTType.png.identifier as CFString,
  1,
  nil
) else {
  fputs("Could not create the PNG destination.\n", stderr)
  exit(70)
}

CGImageDestinationAddImage(destination, renderedImage, nil)

guard CGImageDestinationFinalize(destination) else {
  fputs("Could not encode the output image as PNG.\n", stderr)
  exit(70)
}
