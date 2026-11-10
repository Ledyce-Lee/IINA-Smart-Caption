// Native save picker. Returns a UTF-8 path, empty output on cancel, nonzero on error.
#import <AppKit/AppKit.h>
#include <stdio.h>
#include <string.h>
int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc != 3) { fprintf(stderr, "Expected directory and filename\n"); return 2; }
    NSString *directory = [NSString stringWithUTF8String:argv[1]];
    NSString *filename = [NSString stringWithUTF8String:argv[2]];
    BOOL isDirectory = NO;
    if (!directory || !filename || ![[NSFileManager defaultManager] fileExistsAtPath:directory isDirectory:&isDirectory] || !isDirectory) {
      fprintf(stderr, "Video directory is unavailable\n"); return 2;
    }
    [NSApplication sharedApplication];
    [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];
    [NSApp finishLaunching];
    NSSavePanel *panel = [NSSavePanel savePanel];
    panel.title = @"Smart Caption — 另存为";
    panel.prompt = @"保存";
    panel.directoryURL = [NSURL fileURLWithPath:directory isDirectory:YES];
    panel.nameFieldStringValue = filename;
    panel.canCreateDirectories = YES;
    panel.extensionHidden = NO;
    [NSApp activateIgnoringOtherApps:YES];
    NSModalResponse response = [panel runModal];
    fprintf(stderr, "Save panel response: %ld\n", (long)response);
    if (response == NSModalResponseOK) {
      const char *path = panel.URL.path.UTF8String;
      if (!path) { fprintf(stderr, "No save path returned\n"); return 3; }
      fwrite(path, 1, strlen(path), stdout);
      fputc('\n', stdout);
    }
    if (response != NSModalResponseOK && response != NSModalResponseCancel) {
      fprintf(stderr, "Save panel failed to complete\n"); return 4;
    }
    return 0;
  }
}
