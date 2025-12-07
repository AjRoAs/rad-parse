# Repository Setup Guide

This document explains how to set up `rad-parser` as its own standalone repository.

## Initial Setup

1. **Create a new repository** on GitHub (e.g., `smallvis/rad-parser`)

2. **Initialize git in this directory**:
   ```bash
   cd src/lib/rad-parser
   git init
   git add .
   git commit -m "Initial commit: rad-parser v1.0.0"
   ```

3. **Add remote and push**:
   ```bash
   git remote add origin https://github.com/smallvis/rad-parser.git
   git branch -M main
   git push -u origin main
   ```

## Building

To build the TypeScript files:

```bash
npm run build
```

This will create a `dist/` directory with compiled JavaScript and type definitions.

## Publishing to npm

1. **Update version** in `package.json`
2. **Build the project**: `npm run build`
3. **Test locally**: `npm pack` to create a tarball
4. **Publish**: `npm publish --access public`

## Development Workflow

- **Type checking**: `npm run type-check`
- **Linting**: `npm run lint`
- **Formatting**: `npm run format`

## Integration with SmallVis

After setting up the standalone repository, SmallVis can use it as a dependency:

```json
{
  "dependencies": {
    "@smallvis/rad-parser": "github:smallvis/rad-parser"
  }
}
```

Or after publishing to npm:

```json
{
  "dependencies": {
    "@smallvis/rad-parser": "^1.0.0"
  }
}
```

## File Structure

```
rad-parser/
├── .github/
│   └── workflows/
│       └── ci.yml          # CI/CD configuration
├── dist/                   # Built files (gitignored, created on build)
├── *.ts                    # Source TypeScript files
├── .gitignore             # Git ignore rules
├── .npmignore             # npm publish ignore rules
├── LICENSE                # MIT License
├── package.json           # Package configuration
├── README.md              # Documentation
├── REPOSITORY_SETUP.md    # This file
└── tsconfig.json          # TypeScript configuration
```

