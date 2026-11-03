// File System Access API (Chrome/Edge)。lib.dom に未収録の部分のみ宣言
interface FilePickerAcceptType { description?: string; accept: Record<string, string[]> }
interface OpenFilePickerOptions { types?: FilePickerAcceptType[]; excludeAcceptAllOption?: boolean; multiple?: boolean }
interface SaveFilePickerOptions { types?: FilePickerAcceptType[]; suggestedName?: string }
interface Window {
  showOpenFilePicker?: (o?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (o?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
}
interface FileSystemHandle {
  queryPermission?(d: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(d: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}
