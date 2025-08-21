import React, { useState, useEffect, useRef } from 'react';

const SearchableDropdown = ({ options, placeholder, onSelect, value }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setFilteredOptions(
      options.filter(option => 
        option.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, options]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const handleOptionClick = (option) => {
    setSearchTerm(option.name);
    onSelect(option);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        type="text"
        placeholder={placeholder}
        value={value || searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
      />
      {isOpen && (
        <ul className="absolute z-50 w-full bg-white border border-gray-300 rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map(option => (
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