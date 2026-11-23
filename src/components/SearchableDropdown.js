import React, { useState, useEffect, useRef, useMemo } from 'react';

// Minúsculas, sin acentos y sin espacios de más: "Márquez" se encuentra escribiendo "marquez"
const normalize = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();

const SearchableDropdown = ({ options = [], placeholder, onSelect, value }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const dropdownRef = useRef(null);

  // Opciones que coinciden: primero las que empiezan con lo escrito, después las que lo tienen en el medio
  const filteredOptions = useMemo(() => {
    const q = normalize(searchTerm);
    if (!q) return options;
    return options
      .map((option, index) => {
        const name = normalize(option.name);
        if (!name.includes(q)) return null;
        const rank = name.startsWith(q) ? 0 : name.split(' ').some((w) => w.startsWith(q)) ? 1 : 2;
        return { option, rank, index };
      })
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map((x) => x.option);
  }, [searchTerm, options]);

  const closeList = () => {
    setIsOpen(false);
    setEditing(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setEditing(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [dropdownRef]);

  const handleOptionClick = (option) => {
    setSearchTerm(option.name);
    onSelect(option);
    closeList();
  };

  // Mientras se escribe se ve lo escrito; si no, la opción elegida (value) o el último texto
  const shown = editing ? searchTerm : value !== undefined ? value : searchTerm;

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={shown}
        autoComplete="off"
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setEditing(true);
          setIsOpen(true);
        }}
        onFocus={() => {
          // Al tocar el campo se ve la lista completa para elegir o buscar
          setSearchTerm('');
          setEditing(true);
          setIsOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            closeList();
          } else if (e.key === 'Enter' && isOpen && filteredOptions.length > 0) {
            e.preventDefault();
            handleOptionClick(filteredOptions[0]);
          }
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
      />
      {isOpen && (
        <ul className="absolute z-50 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <li
                key={option.id}
                onClick={() => handleOptionClick(option)}
                className="p-2 cursor-pointer hover:bg-pink-100"
              >
                {option.name}
              </li>
            ))
          ) : (
            <li className="p-2 text-gray-500 italic">No se encontraron resultados</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchableDropdown;
