/* Modified for OfferMe (2026); derived from MeetingCopilot. See UPSTREAM.md. */
import CoreAudio
import Foundation

// Run after BlackHole has appeared in macOS audio devices. This creates a
// persistent Multi-Output Device using the current speaker output and BlackHole.
private let aggregateUID = "io.github.xiao0309.offerme.multioutput.blackhole2ch"
private let aggregateName = "OfferMe + BlackHole"
private let dataDirectory = ProcessInfo.processInfo.environment["OFFERME_DATA_DIR"].map { URL(fileURLWithPath: $0) }
  ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/OfferMe")
private let stateURL = dataDirectory.appendingPathComponent("audio-routing.json")

private enum AudioSetupError: Error, CustomStringConvertible {
  case status(String, OSStatus)
  case missing(String)

  var description: String {
    switch self {
    case let .status(operation, code): return "\(operation) failed (OSStatus \(code))"
    case let .missing(message): return message
    }
  }
}

private func address(_ selector: AudioObjectPropertySelector) -> AudioObjectPropertyAddress {
  AudioObjectPropertyAddress(
    mSelector: selector,
    mScope: kAudioObjectPropertyScopeGlobal,
    mElement: kAudioObjectPropertyElementMain
  )
}

private func devices() throws -> [AudioDeviceID] {
  var property = address(kAudioHardwarePropertyDevices)
  var size: UInt32 = 0
  let system = AudioObjectID(kAudioObjectSystemObject)
  var status = AudioObjectGetPropertyDataSize(system, &property, 0, nil, &size)
  guard status == noErr else { throw AudioSetupError.status("list devices", status) }
  var ids = [AudioDeviceID](repeating: 0, count: Int(size) / MemoryLayout<AudioDeviceID>.size)
  status = ids.withUnsafeMutableBytes { bytes in
    AudioObjectGetPropertyData(system, &property, 0, nil, &size, bytes.baseAddress!)
  }
  guard status == noErr else { throw AudioSetupError.status("read devices", status) }
  return ids
}

private func stringProperty(_ id: AudioObjectID, _ selector: AudioObjectPropertySelector) -> String? {
  var property = address(selector)
  var value: CFString = "" as CFString
  var size = UInt32(MemoryLayout<CFString>.size)
  let status = withUnsafeMutablePointer(to: &value) { pointer in
    AudioObjectGetPropertyData(id, &property, 0, nil, &size, pointer)
  }
  return status == noErr ? value as String : nil
}

private func name(_ id: AudioDeviceID) -> String {
  stringProperty(id, kAudioObjectPropertyName) ?? "<unknown>"
}

private func uid(_ id: AudioDeviceID) -> String? {
  stringProperty(id, kAudioDevicePropertyDeviceUID)
}

private func defaultOutput() throws -> AudioDeviceID {
  var property = address(kAudioHardwarePropertyDefaultOutputDevice)
  var device = AudioDeviceID(kAudioObjectUnknown)
  var size = UInt32(MemoryLayout<AudioDeviceID>.size)
  let status = AudioObjectGetPropertyData(
    AudioObjectID(kAudioObjectSystemObject), &property, 0, nil, &size, &device
  )
  guard status == noErr else { throw AudioSetupError.status("read default output", status) }
  return device
}

private func setDefaultOutput(_ device: AudioDeviceID) throws {
  var property = address(kAudioHardwarePropertyDefaultOutputDevice)
  var value = device
  let size = UInt32(MemoryLayout<AudioDeviceID>.size)
  let status = AudioObjectSetPropertyData(
    AudioObjectID(kAudioObjectSystemObject), &property, 0, nil, size, &value
  )
  guard status == noErr else { throw AudioSetupError.status("set default output", status) }
}

private func findByUID(_ value: String, in ids: [AudioDeviceID]) -> AudioDeviceID? {
  ids.first { uid($0) == value }
}

private func activeSubDevices(_ id: AudioDeviceID) throws -> [AudioDeviceID] {
  var property = address(kAudioAggregateDevicePropertyActiveSubDeviceList)
  var size: UInt32 = 0
  var status = AudioObjectGetPropertyDataSize(id, &property, 0, nil, &size)
  guard status == noErr else { throw AudioSetupError.status("list active output members", status) }
  guard size > 0 else { return [] }
  var members = [AudioDeviceID](repeating: 0, count: Int(size) / MemoryLayout<AudioDeviceID>.size)
  status = members.withUnsafeMutableBytes { bytes in
    AudioObjectGetPropertyData(id, &property, 0, nil, &size, bytes.baseAddress!)
  }
  guard status == noErr else { throw AudioSetupError.status("read active output members", status) }
  return members
}

private func isAggregate(_ device: AudioDeviceID) -> Bool {
  var property = address(kAudioAggregateDevicePropertyActiveSubDeviceList)
  return AudioObjectHasProperty(device, &property)
}

private func hasOutput(_ device: AudioDeviceID) -> Bool {
  var property = address(kAudioDevicePropertyStreams)
  property.mScope = kAudioDevicePropertyScopeOutput
  var size: UInt32 = 0
  return AudioObjectGetPropertyDataSize(device, &property, 0, nil, &size) == noErr && size > 0
}

private func routeIsHealthy(_ device: AudioDeviceID) -> Bool {
  let members = (try? activeSubDevices(device)) ?? []
  return members.contains { uid($0) == "BlackHole2ch_UID" } &&
    members.contains { uid($0) != "BlackHole2ch_UID" && uid($0) != nil && hasOutput($0) }
}

// Read-only: a compatible route created by another app is also valid. Never
// replace that app's aggregate or nest a Multi-Output inside another one.
private func checkRoute() throws {
  let current = try defaultOutput()
  let members = (try? activeSubDevices(current)) ?? []
  let healthy = routeIsHealthy(current)
  let code = healthy ? "OK" : (members.isEmpty ? "OUTPUT_BYPASSES_BLACKHOLE" : "OUTPUT_DISCONNECTED")
  let fingerprint = ([uid(current) ?? "unknown"] + members.compactMap(uid).sorted()).joined(separator: "|")
  let result: [String: Any] = ["ok": healthy, "code": code, "fingerprint": fingerprint]
  let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
  print(String(decoding: data, as: UTF8.self))
}

private func showStatus() throws {
  let ids = try devices()
  let current = try defaultOutput()
  for id in ids {
    print("\(id == current ? "*" : " ") \(name(id)) [\(uid(id) ?? "no UID")]")
  }
  print("BlackHole detected: \(ids.contains { name($0).localizedCaseInsensitiveContains("BlackHole") })")
  if let aggregate = findByUID(aggregateUID, in: ids) {
    let members = try activeSubDevices(aggregate)
    print("Multi-output active members: \(members.map(name).joined(separator: " + "))")
  }
}

private func configure() throws {
  let ids = try devices()
  guard let blackHole = ids.first(where: {
    name($0).localizedCaseInsensitiveContains("BlackHole") &&
      name($0).localizedCaseInsensitiveContains("2ch")
  }), let blackHoleUID = uid(blackHole) else {
    throw AudioSetupError.missing("BlackHole 2ch is not loaded; reboot macOS first")
  }

  let current = try defaultOutput()
  if routeIsHealthy(current) {
    print("Audio routing verified: \(name(current))")
    return
  }
  if isAggregate(current) {
    throw AudioSetupError.missing("OUTPUT_DISCONNECTED: Reconnect your headphones, or select a physical output, then retry")
  }
  guard current != blackHole, let speakerUID = uid(current) else {
    throw AudioSetupError.missing("Select the speakers/headphones you want to hear first")
  }

  if let members = try? activeSubDevices(current), !members.isEmpty {
    throw AudioSetupError.missing("Select physical speakers/headphones before creating a new Multi-Output Device")
  }

  if let old = findByUID(aggregateUID, in: ids) {
    let status = AudioHardwareDestroyAggregateDevice(old)
    guard status == noErr else { throw AudioSetupError.status("replace old Multi-Output Device", status) }
  }

  let description: [String: Any] = [
    kAudioAggregateDeviceNameKey: aggregateName,
    kAudioAggregateDeviceUIDKey: aggregateUID,
    kAudioAggregateDeviceSubDeviceListKey: [
      [kAudioSubDeviceUIDKey: speakerUID],
      [kAudioSubDeviceUIDKey: blackHoleUID, kAudioSubDeviceDriftCompensationKey: 1],
    ],
    kAudioAggregateDeviceMainSubDeviceKey: speakerUID,
    kAudioAggregateDeviceIsStackedKey: 1,
    kAudioAggregateDeviceIsPrivateKey: 0,
  ]
  var aggregate = AudioDeviceID(kAudioObjectUnknown)
  let created = AudioHardwareCreateAggregateDevice(description as CFDictionary, &aggregate)
  guard created == noErr else { throw AudioSetupError.status("create Multi-Output Device", created) }

  do {
    try setDefaultOutput(aggregate)
    try FileManager.default.createDirectory(
      at: stateURL.deletingLastPathComponent(), withIntermediateDirectories: true
    )
    let state = ["previousOutputUID": speakerUID, "aggregateUID": aggregateUID]
    let data = try JSONSerialization.data(withJSONObject: state, options: [.prettyPrinted])
    try data.write(to: stateURL, options: [.atomic])
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: stateURL.path)
  } catch {
    try? setDefaultOutput(current)
    _ = AudioHardwareDestroyAggregateDevice(aggregate)
    throw error
  }
  print("Audio routed to \(name(current)) and BlackHole 2ch")
  print("Previous output recorded at \(stateURL.path)")
}

private func restore() throws {
  let data = try Data(contentsOf: stateURL)
  guard let state = try JSONSerialization.jsonObject(with: data) as? [String: String],
        let priorUID = state["previousOutputUID"],
        let previous = findByUID(priorUID, in: try devices()) else {
    throw AudioSetupError.missing("Previous output device is not available")
  }
  try setDefaultOutput(previous)
  try FileManager.default.removeItem(at: stateURL)
  print("Restored output to \(name(previous))")
}

do {
  switch CommandLine.arguments.dropFirst().first ?? "status" {
  case "status": try showStatus()
  case "check": try checkRoute()
  case "configure": try configure()
  case "restore": try restore()
  default: throw AudioSetupError.missing("Usage: audio-route [status|check|configure|restore]")
  }
} catch {
  fputs("\(error)\n", stderr)
  exit(1)
}
