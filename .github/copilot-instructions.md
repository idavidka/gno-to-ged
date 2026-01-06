# GitHub Copilot Instructions - GNO to GED Converter

## Project Overview

**GNO to GED** (@treeviz/gno-to-ged) is a CLI tool and library for converting between GNO (compressed GEDCOM) and GED (standard GEDCOM) formats. It provides bidirectional conversion with optional compression.

### Tech Stack

- **Language**: TypeScript
- **Build Tool**: Vite
- **Testing**: Vitest
- **CLI**: Node.js command-line interface
- **Compression**: gzip compression for GNO format
- **Module Format**: ES Modules

### Project Structure

```
gno-to-ged/
├── src/
│   ├── cli.ts             # CLI entry point
│   ├── converter.ts       # Core conversion logic
│   ├── types.ts           # TypeScript definitions
│   ├── __tests__/         # Unit tests
│   └── index.ts           # Library entry point
├── bin/
│   └── gno-to-ged         # CLI executable
└── docs/                  # Documentation
```

### Key Features

1. **GED to GNO Conversion**: Convert standard GEDCOM files to compressed GNO format
2. **GNO to GED Conversion**: Decompress GNO files back to standard GEDCOM
3. **CLI Tool**: Command-line interface for batch processing
4. **Library API**: Import as a module in Node.js or browser
5. **Compression Options**: Configurable compression levels
6. **Validation**: Verify file integrity after conversion

### Code Style & Conventions

1. **Language**: All code, comments, and documentation should be in **English**
   - **Code**: Variable names, function names, class names must be in English
   - **Comments**: All inline comments and documentation comments must be in English
   - **Documentation**: All `.md` files must be in English
   - **Commit Messages**: Write commit messages in English
   - **Copilot Responses**: Always respond in the **same language as the user's question**
2. **TypeScript**: Strict mode enabled, avoid `any` types
3. **File Naming**: `kebab-case.ts`
4. **Error Handling**: Use descriptive error messages
5. **CLI**: Follow POSIX conventions for command-line arguments
6. **Testing**: Test both CLI and library usage

### Commit Message Convention

Follow **Conventional Commits** specification:

**Format:** `<type>(<scope>): <subject>`

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `chore`: Other changes

**Examples:**
```
feat(cli): add batch conversion mode
fix(converter): handle empty GEDCOM files
docs: update CLI usage examples
test(converter): add compression level tests
perf(converter): optimize large file processing
```

### Common Tasks

#### CLI Usage
```bash
# Convert GED to GNO
gno-to-ged input.ged -o output.gno

# Convert GNO to GED
gno-to-ged input.gno -o output.ged

# With compression level
gno-to-ged input.ged -o output.gno --compression 9
```

#### Library Usage
```typescript
import { gedToGno, gnoToGed } from '@treeviz/gno-to-ged';

// Convert GED to GNO
const gnoData = await gedToGno('./input.ged', {
  compression: 6,
  validate: true
});

// Convert GNO to GED
const gedContent = await gnoToGed('./input.gno');
```

#### Running Tests
```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
npm run test:ui      # Vitest UI
```

#### Building
```bash
npm run build        # Build for production
npm run dev          # Development mode
```

#### Publishing to NPM
```bash
npm version patch|minor|major
npm run build
npm publish
```

### File Formats

#### GEDCOM (.ged)
- Standard genealogy data format
- Plain text, line-based structure
- Human-readable
- Large file sizes

#### GNO (.gno)
- Compressed GEDCOM format
- Binary format with gzip compression
- ~70-90% size reduction
- Preserves all GEDCOM data

### API Structure

#### Main Functions

1. **gedToGno(input, options)**
   - Converts GEDCOM to GNO format
   - Options: compression level, output path, validation
   - Returns: Buffer or file path

2. **gnoToGed(input, options)**
   - Converts GNO to GEDCOM format
   - Options: output path, validation
   - Returns: String or file path

3. **validateGedcom(content)**
   - Validates GEDCOM structure
   - Returns: Validation result with errors

### Testing Best Practices

1. **File Handling**: Test with various file sizes
2. **Compression**: Test all compression levels (0-9)
3. **Round-trip**: Ensure GED → GNO → GED preserves data
4. **Error Cases**: Test malformed files, missing files, permissions
5. **CLI**: Test command-line argument parsing

### Performance Optimization

- **Streaming**: Use streams for large files
- **Compression**: Default level 6 balances speed/size
- **Memory**: Avoid loading entire files into memory
- **Async**: All I/O operations are async

### Common Issues & Solutions

#### Large File Memory Usage
- Use streaming APIs for files >100MB
- Implement chunked processing
- Monitor memory consumption

#### Compression Performance
- Lower compression (1-3) for faster processing
- Higher compression (7-9) for smaller files
- Default level 6 is optimal for most cases

#### Cross-platform Path Issues
- Use `path.join()` for file paths
- Handle Windows/Unix path differences
- Test on multiple platforms

### CLI Best Practices

1. **Help Text**: Clear usage instructions with `--help`
2. **Error Messages**: Descriptive error messages with exit codes
3. **Progress**: Show progress for large files
4. **Validation**: Validate input before processing
5. **Exit Codes**: 0 for success, non-zero for errors

### Documentation

All public APIs should have JSDoc comments:

```typescript
/**
 * Convert GEDCOM file to GNO format
 * @param input - Path to GEDCOM file or Buffer
 * @param options - Conversion options
 * @returns Buffer with compressed GNO data
 * @throws Error if file is invalid or inaccessible
 */
export async function gedToGno(
  input: string | Buffer,
  options?: ConversionOptions
): Promise<Buffer> {
  // ...
}
```

### Contact & Resources

- **NPM Package**: @treeviz/gno-to-ged
- **Repository**: https://github.com/idavidka/gno-to-ged
- **CLI Documentation**: README.md
- **Parent Project**: TreeViz Monorepo

---

**When working on this project:**
1. Always write in English (code, comments, docs)
2. Test both CLI and library interfaces
3. Validate round-trip conversion (GED → GNO → GED)
4. Handle errors gracefully with clear messages
5. Optimize for large file processing
6. Follow Node.js CLI best practices
7. **After completing changes, ALWAYS suggest a commit message** following Conventional Commits format

**Commit Message Reminder:**
After making any changes, ALWAYS provide a suggested commit message at the end of your response:

```
---

## 🎯 Suggested Commit Message

type(scope): brief description
```
