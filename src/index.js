// src/index.js
import fs from 'fs';
import path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkReact from 'remark-react';
import matter from 'gray-matter';
import React from 'react';

// Custom function to handle button creation
function createButtonComponent(options) {
  const { action, changeTo, text } = options;
  return `
    <button onClick={() => handleAction('${action}', '${changeTo}')}>
      ${text || 'Click Me'}
    </button>
  `;
}

const WHITELIST = ['title']; // Variables to exclude from being treated as custom variables

async function convertMarkdownToReact(markdown) {
  const { data, content } = matter(markdown); // Parse front matter and content

  // Create a list of custom variables, excluding the whitelist
  const customVariables = Object.keys(data).filter(key => !WHITELIST.includes(key));

  // Replace custom variables in the content
  let processedContent = content;

  // Regex to find custom button syntax with optional parameters
  const buttonRegex = /\[button(?:\s+action=\{(.*?)\})?(?:\s+changeto=\{(.*?)\})?(?:\s+text=\{(.*?)\})?\]/g;
  
  // Replace button syntax with button component
  processedContent = processedContent.replace(buttonRegex, (match, action, changeTo, buttonText) => {
    const options = {
      action: action || null,
      changeTo: changeTo || null,
      text: buttonText || 'Click Me', // Default button text if not provided
    };
    return createButtonComponent(options);
  });

  // Replace custom variables in the content
  customVariables.forEach(key => {
    // Wrap the variable reference with single curly braces
    processedContent = processedContent.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), `{customVariables.${key}}`);
  });

  const result = await unified()
    .use(remarkParse)
    .use(remarkReact, { createElement: React.createElement }) // Pass createElement
    .process(processedContent); // Process the modified content

  return { data, customVariables, component: result }; // Return data, custom variables, and the React component
}

async function processMarkdownFile(filePath) {
  const markdown = fs.readFileSync(filePath, 'utf8');
  const { data, customVariables, component } = await convertMarkdownToReact(markdown);
  return { filePath, data, customVariables, component };
}

function findMarkdownFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(findMarkdownFiles(filePath)); // Recur into subdirectory
    } else if (file.endsWith('.md')) {
      results.push(filePath); // Push Markdown file
    }
  });

  return results;
}

// Command-line interface
const directoryPath = process.argv[2];
const outputDir = path.join(process.cwd(), 'pages', 'site'); // Output to pages/site

if (!directoryPath) {
  console.error('Please provide a path to a directory.');
  process.exit(1);
}

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true }); // Create directory if it doesn't exist
}

const markdownFiles = findMarkdownFiles(directoryPath);

Promise.all(markdownFiles.map(processMarkdownFile))
  .then((parsedFiles) => {
    parsedFiles.forEach(({ filePath, data, customVariables, component }) => {
      const fileName = path.basename(filePath, '.md');
      const outputFilePath = path.join(outputDir, `${fileName}.tsx`);

      // Generate useState declarations for custom variables
      const stateDeclarations = customVariables.map(key => `${key}: ${data[key] || 0}`).join(',\n    ');

      // Create TypeScript component with type annotations
      const componentContent = `
import React, { useState } from 'react';

interface CustomVariables {
  ${customVariables.map(key => `${key}: number;`).join('\n  ')} // Type definitions for custom variables
}

const ${fileName}: React.FC = () => {
  const [customVariables, setCustomVariables] = useState<CustomVariables>({
    ${stateDeclarations}
  });

  const handleAction = (action: string | null, changeTo: string | null) => {
    if (action === 'change' && changeTo) {
      const newValue = eval(changeTo.replace(/customVariables/gi, 'customVariables'));
      setCustomVariables(prev => ({ ...prev, [Object.keys(prev)[0]]: newValue })); // Update the first variable
    }
    // Additional actions can be added here
  };

  return (
    <div>
      <h1>${data.title || fileName}</h1>
      <div>
        ${component} {/* Render the processed content */}
      </div>
    </div>
  );
};

export default ${fileName};
`;

      fs.writeFileSync(outputFilePath, componentContent.trim());
      console.log(`Created TSX file: ${outputFilePath}`);
    });
  })
  .catch((error) => {
    console.error('Error processing Markdown files:', error);
  });