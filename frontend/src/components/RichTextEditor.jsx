import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { normalizeRichTextValue } from "../utils/richText";

const modules = {
  toolbar: [
    [{ header: [false, 2, 3] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["blockquote", "link"],
  ],
  clipboard: {
    matchVisual: false,
  },
};

const formats = [
  "header",
  "bold",
  "italic",
  "underline",
  "list",
  "bullet",
  "blockquote",
  "link",
];

const RichTextEditor = ({
  value = "",
  onChange,
  placeholder = "",
  className = "",
  minHeight = 180,
}) => (
  <div className={`app-richtext ${className}`.trim()}>
    <ReactQuill
      theme="snow"
      value={normalizeRichTextValue(value)}
      onChange={(nextValue) => onChange?.(normalizeRichTextValue(nextValue))}
      placeholder={placeholder}
      modules={modules}
      formats={formats}
      style={{ minHeight }}
    />
  </div>
);

export default RichTextEditor;
