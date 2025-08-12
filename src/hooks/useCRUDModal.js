// src/hooks/useCRUDModal.js
import { useState } from 'react';

const useCRUDModal = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setItemToDelete(null);
  };
  
  const confirmDelete = (index) => setItemToDelete(index);
  const cancelDelete = () => setItemToDelete(null);
  
  return {
    isModalOpen,
    itemToDelete,
    openModal,
    closeModal,
    confirmDelete,
    cancelDelete,
  };
};

export default useCRUDModal;