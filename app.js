
    // Global State
    let links = JSON.parse(localStorage.getItem("driveLinks")) || [];
    let categories = JSON.parse(localStorage.getItem("driveCategories")) || ["All"];
    let selectedLinks = new Set();
    let editingIndex = -1;
    let currentCSVFile = null;
    let currentCategoryFilter = "All";
    
    // NEW STATE: Manages the bulk adding process
    let isCategoryBulkAdding = false;

    // Initialization Functions
    // -----------------------------------------------------------------------------

    function migrateData() {
      let needsSave = false;
      links = links.map(link => {
        if (!link.categories) {
          link.categories = ["All"];
          needsSave = true;
        }
        return link;
      });
      if (needsSave) {
        saveToLocalStorage();
      }
    }

    function init() {
      migrateData();
      links.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
      updateCategoryFilter();
      renderTable();
      updateStats();
      setupDragAndDrop();
    }

    // Data Persistence and Utility
    // -----------------------------------------------------------------------------

    function saveToLocalStorage() {
      localStorage.setItem("driveLinks", JSON.stringify(links));
      localStorage.setItem("driveCategories", JSON.stringify(categories));
      updateStats();
    }

    function getFileId(link) {
      const match = link.match(/id=([^&]+)/);
      return match ? match[1] : null;
    }

    function updateStats() {
      document.getElementById('totalLinks').textContent = links.length;
      document.getElementById('selectedCount').textContent = selectedLinks.size;
      document.getElementById('categoryCount').textContent = categories.length;
    }

    function showNotification(message, isError = false) {
      const notification = document.getElementById('notification');
      notification.textContent = message;
      notification.style.background = isError ? '#ef4444' : '#10b981';
      notification.className = 'notification show';
      setTimeout(() => notification.className = 'notification', 3000);
    }
    
    // Link Conversion and Management
    // (convertGoogleDriveLink, convertLink, copyToClipboard, deleteLink remain the same)
    // ...

    function convertGoogleDriveLink(link) {
      if (link.includes('uc?export=view')) {
        return link;
      }
      const fileId = link.match(/[-\w]{25,}/);
      return fileId ? `https://drive.google.com/uc?export=view&id=${fileId[0]}` : link;
    }

    function convertLink() {
      const input = document.getElementById("inputLink").value.trim();
      const name = document.getElementById("inputName").value.trim() || "Untitled";
      const match = input.match(/[-\w]{25,}/);
      const outputDiv = document.getElementById("output");

      if (match) {
        const id = match[0];
        const result = `https://drive.google.com/uc?export=view&id=${id}`;
        
        outputDiv.className = "show";
        outputDiv.innerHTML = `
          <p>✓ Link converted successfully!</p>
          <a href="${result}" target="_blank">${result}</a>
          <button class="btn-copy" style="margin-top:8px" onclick="copyToClipboard('${result}', this)">Copy Link</button>
        `;
        
        links.unshift({ 
          name, 
          link: result,
          categories: ["All"],
          dateAdded: new Date().toISOString()
        });
        
        saveToLocalStorage();
        renderTable();
        document.getElementById("inputLink").value = "";
        document.getElementById("inputName").value = "";
        showNotification('Link added');
      } else {
        outputDiv.className = "show error";
        outputDiv.innerHTML = "<p>✗ Invalid Google Drive link</p>";
      }
    }

    function copyToClipboard(text, btn) {
      navigator.clipboard.writeText(text)
        .then(() => {
          btn.textContent = "Copied!";
          setTimeout(() => btn.textContent = "Copy", 2000);
          showNotification('Link copied');
        })
        .catch(() => showNotification('Failed to copy', true));
    }

    function deleteLink(index) {
      if (confirm("Delete this link?")) {
        links.splice(index, 1);
        saveToLocalStorage();
        selectedLinks.delete(index);
        renderTable();
        showNotification('Link deleted');
      }
    }
    
    // Table Rendering and Editing
    // (renderTable, updateUI, startEditing, saveEdit, cancelEdit remain the same)
    // ...

    function renderTable(linksToRender = null) {
      const tableBody = document.getElementById("tableBody");
      
      // If no specific links provided, apply current filters
      if (linksToRender === null) {
        linksToRender = links;
        if (currentCategoryFilter !== "All") {
          linksToRender = linksToRender.filter(item => 
            item.categories && item.categories.includes(currentCategoryFilter)
          );
        }
      }
      
      if (linksToRender.length === 0) {
        const message = (links.length === 0) 
          ? 'No links yet. Convert your first link or import a CSV to get started!' 
          : 'No links found matching current filters.';
        tableBody.innerHTML = `<tr class="empty-state"><td colspan="4"><p>${message}</p></td></tr>`;
        updateUI();
        return;
      }

      let html = '';
      linksToRender.forEach((item) => {
        // Find the original index in the full links array
        const actualIndex = links.indexOf(item);
        const fileId = getFileId(item.link);
        const isSelected = selectedLinks.has(actualIndex);
        const isEditing = editingIndex === actualIndex;
        
        html += `
          <tr>
            <td><input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleSelect(${actualIndex}, this.checked)"></td>
            <td>
              <div class="name-edit-container">
                ${isEditing ? 
                  `<input type="text" class="name-input" value="${item.name}" id="editNameInput-${actualIndex}">
                   <div class="edit-controls">
                     <button class="btn-save" onclick="saveEdit(${actualIndex})">Save</button>
                     <button class="btn-cancel" onclick="cancelEdit()">Cancel</button>
                   </div>` : 
                  `<div>
                     <span class="name-display" ondblclick="startEditing(${actualIndex})">${item.name}</span>
                     <div class="category-tags">
                       ${item.categories.map(cat => 
                         `<span class="category-tag ${cat === 'All' ? 'all' : ''}">${cat}</span>`
                       ).join('')}
                     </div>
                   </div>`
                }
              </div>
            </td>
            <td>
              <div class="preview-container">
                ${fileId ? 
                  `<img class="preview-image" src="https://drive.google.com/thumbnail?id=${fileId}&sz=w100" alt="Preview">` : 
                  '<div class="preview-placeholder">No Preview</div>'
                }
                <a href="${item.link}" target="_blank" class="link-text">${item.link}</a>
              </div>
            </td>
            <td>
              <div class="action-buttons">
                <button class="btn-copy" onclick="copyToClipboard('${item.link}', this)">Copy</button>
                ${!isEditing ? `<button class="btn-edit" onclick="startEditing(${actualIndex})">Edit</button>` : ''}
                <button class="btn-delete" onclick="deleteLink(${actualIndex})">Delete</button>
              </div>
            </td>
          </tr>
        `;
      });
      
      tableBody.innerHTML = html;
      updateUI();
    }

    function updateUI() {
      const hasSelection = selectedLinks.size > 0;
      document.getElementById("exportBtn").disabled = !hasSelection;
      document.getElementById("bulkCopyBtn").disabled = !hasSelection;
      document.getElementById("bulkDeleteBtn").disabled = !hasSelection;
      document.getElementById("createCategoryBtn").disabled = !hasSelection;
      
      // Bulk add button is only disabled if no selection AND not already in selection mode
      document.getElementById("addCategoryBtn").disabled = !hasSelection && !isCategoryBulkAdding;
      
      // Update select all checkbox based on visible items
      const visibleCount = document.querySelectorAll('#tableBody tr:not(.empty-state)').length;
      document.getElementById("selectAll").checked = hasSelection && selectedLinks.size === visibleCount;
      updateStats();
    }

    function startEditing(index) {
      editingIndex = index;
      renderTable();
      setTimeout(() => {
        const input = document.getElementById(`editNameInput-${index}`);
        if (input) {
          input.focus();
          input.select();
        }
      }, 10);
    }

    function saveEdit(index) {
      const input = document.getElementById(`editNameInput-${index}`);
      if (input && input.value.trim()) {
        links[index].name = input.value.trim();
        saveToLocalStorage();
        editingIndex = -1;
        renderTable();
        showNotification('Name updated');
      }
    }

    function cancelEdit() {
      editingIndex = -1;
      renderTable();
    }
    
    // Filtering and Searching
    // -----------------------------------------------------------------------------

    // Renders pills instead of a dropdown
    function updateCategoryFilter() {
      const pillsContainer = document.getElementById('categoryFilterPills');
      
      // Set the bulk-add class based on state
      pillsContainer.className = `category-pills-container ${isCategoryBulkAdding ? 'bulk-add-mode' : ''}`;

      pillsContainer.innerHTML = categories.map(cat => {
        const isActive = cat === currentCategoryFilter;
        
        if (cat === 'All' || isCategoryBulkAdding) {
             // 'All' pill is just a filter/selection target
             // In bulk-add mode, all pills become simple selection targets
            return `<div class="category-pill ${isActive ? 'active' : ''}" 
                          onclick="${isCategoryBulkAdding ? `bulkAddSelectedCategory('${cat}')` : `filterByCategory('${cat}')`}">
                        <span class="pill-name">${cat}</span>
                    </div>`;
        } else {
             // Custom pills get edit/delete controls when not in bulk-add mode
            return `
                <div class="category-pill ${isActive ? 'active' : ''}">
                    <span class="pill-name" onclick="filterByCategory('${cat}')">${cat}</span>
                    <div class="pill-controls">
                        <span class="pill-action pill-edit" onclick="editCategoryName('${cat}')" title="Edit Name">✎</span>
                        <span class="pill-action pill-delete" onclick="deleteCategory('${cat}')" title="Delete Category">×</span>
                    </div>
                </div>
            `;
        }
      }).join('');
    }

    // New filter function for pill clicks
    function filterByCategory(category) {
        // Prevent filtering if currently in the bulk-add selection mode
        if (isCategoryBulkAdding) return;
        
        if (currentCategoryFilter === category) {
            // Clicking an active pill clears the filter
            currentCategoryFilter = "All";
        } else {
            currentCategoryFilter = category;
        }
        
        updateCategoryFilter();
        applyFilters();
    }

    function applyFilters() {
      const searchFilter = document.getElementById("searchBox").value.toLowerCase();
      
      let filtered = links;
      
      // Apply category filter (uses the value set by filterByCategory)
      if (currentCategoryFilter !== "All") {
        filtered = filtered.filter(item => 
          item.categories && item.categories.includes(currentCategoryFilter)
        );
      }
      
      // Apply search filter
      if (searchFilter) {
        filtered = filtered.filter(item => 
          item.name.toLowerCase().includes(searchFilter)
        );
      }
      
      renderTable(filtered);
    }

    function clearFilters() {
      document.getElementById("searchBox").value = "";
      currentCategoryFilter = "All"; // Reset category state
      updateCategoryFilter(); // Rerender pills to set 'All' as active
      renderTable(); // Rerun filtering
    }

    // Selection and Bulk Actions
    // (toggleSelect, toggleSelectAll, bulkCopyLinks, bulkDeleteLinks, exportToCSV remain the same)
    // ...

    function toggleSelect(index, isSelected) {
      isSelected ? selectedLinks.add(index) : selectedLinks.delete(index);
      updateUI();
    }

    function toggleSelectAll(isSelected) {
      selectedLinks.clear();
      if (isSelected) {
        // Get visible items based on current filter
        let visibleLinks = links;
        if (currentCategoryFilter !== "All") {
          visibleLinks = links.filter(item => 
            item.categories && item.categories.includes(currentCategoryFilter)
          );
        }
        visibleLinks.forEach(item => {
          const index = links.indexOf(item);
          selectedLinks.add(index);
        });
      }
      renderTable();
    }

    function bulkCopyLinks() {
      if (selectedLinks.size === 0) return;
      const linksText = Array.from(selectedLinks).map(i => links[i].link).join('\n');
      navigator.clipboard.writeText(linksText)
        .then(() => showNotification(`${selectedLinks.size} links copied`))
        .catch(() => showNotification('Failed to copy', true));
    }

    function bulkDeleteLinks() {
      if (selectedLinks.size === 0) return;
      if (confirm(`Delete ${selectedLinks.size} links?`)) {
        const count = selectedLinks.size;
        Array.from(selectedLinks).sort((a, b) => b - a).forEach(i => links.splice(i, 1));
        selectedLinks.clear();
        saveToLocalStorage();
        renderTable();
        showNotification(`${count} links deleted`);
      }
    }

    function exportToCSV() {
      if (selectedLinks.size === 0) return;
      const csvContent = "Name,Link,Categories\n" + 
        Array.from(selectedLinks).map(i => {
          const item = links[i];
          const cats = item.categories.filter(c => c !== 'All').join(';');
          return `"${item.name}","${item.link}","${cats}"`;
        }).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'drive_links.csv';
      a.click();
      URL.revokeObjectURL(url);
      showNotification('CSV exported');
    }

    // Category Management (Updated)
    // -----------------------------------------------------------------------------

    function createNewCategory() {
      if (selectedLinks.size === 0) {
        showNotification('Please select items first', true);
        return;
      }

      const categoryName = prompt('Enter new category name:');
      if (!categoryName || !categoryName.trim()) {
        return;
      }

      const newCategory = categoryName.trim();

      if (newCategory === 'All') {
        showNotification('Cannot create category named "All"', true);
        return;
      }

      if (categories.includes(newCategory)) {
        showNotification(`Category "${newCategory}" already exists. Please use "Add to Category"`, true);
        return;
      }

      // 1. Add category to list
      categories.push(newCategory);
      updateCategoryFilter();

      // 2. Add category to selected items
      let addedCount = 0;
      selectedLinks.forEach(index => {
        if (!links[index].categories.includes(newCategory)) {
          links[index].categories.push(newCategory);
          addedCount++;
        }
      });

      saveToLocalStorage();
      renderTable();
      showNotification(`Category "${newCategory}" created and added to ${addedCount} items`);
    }

    // Toggles the UI into selection mode for bulk adding categories
    function toggleCategoryBulkAddMode() {
        if (!isCategoryBulkAdding && selectedLinks.size === 0) {
            showNotification('Please select items first', true);
            return;
        }

        isCategoryBulkAdding = !isCategoryBulkAdding;
        
        // Visually update the button and container
        const addBtn = document.getElementById('addCategoryBtn');
        
        if (isCategoryBulkAdding) {
            addBtn.textContent = 'Cancel Selection';
            addBtn.classList.add('btn-bulk-cancel');
            showNotification('Click a category pill below to add it to the selected links. Click the button again to cancel.', false);
        } else {
            addBtn.textContent = 'Add to Category';
            addBtn.classList.remove('btn-bulk-cancel');
            showNotification('Category selection cancelled.');
        }
        
        // Rerender pills to update visibility of edit/delete buttons and click actions
        updateCategoryFilter(); 
        updateUI(); // Updates the disabled state of the button
    }

    // Handles the click on a category pill when in bulk-add mode
    function bulkAddSelectedCategory(category) {
        if (!isCategoryBulkAdding) return; // Should not happen, but a safeguard

        if (category === 'All') {
            showNotification('Cannot add the "All" category manually.', true);
            return;
        }
        
        let addedCount = 0;
        selectedLinks.forEach(index => {
            if (!links[index].categories.includes(category)) {
                links[index].categories.push(category);
                addedCount++;
            }
        });

        saveToLocalStorage();
        renderTable();
        
        // Exit bulk-add mode after action
        toggleCategoryBulkAddMode(); 
        
        if (addedCount > 0) {
            showNotification(`Added ${addedCount} items to "${category}"`);
        } else {
            showNotification(`All selected items already in "${category}"`);
        }
    }

    // Function to edit a category name
    function editCategoryName(oldName) {
      if (oldName === 'All') return; // Safety check

      const newName = prompt(`Rename category "${oldName}" to:`);
      
      if (!newName || !newName.trim() || newName === oldName) {
        return;
      }
      
      const trimmedNewName = newName.trim();
      
      if (trimmedNewName === 'All') {
          showNotification('Cannot rename to "All"', true);
          return;
      }
      
      if (categories.includes(trimmedNewName)) {
        showNotification('Category already exists!', true);
        return;
      }

      // 1. Update the categories array
      const index = categories.indexOf(oldName);
      if (index !== -1) {
        categories[index] = trimmedNewName;
      }
      
      // 2. Update all links
      links.forEach(link => {
        const catIndex = link.categories.indexOf(oldName);
        if (catIndex !== -1) {
          link.categories[catIndex] = trimmedNewName;
        }
      });

      // 3. Update current filter if the edited category was active
      if (currentCategoryFilter === oldName) {
          currentCategoryFilter = trimmedNewName;
      }

      saveToLocalStorage();
      updateCategoryFilter();
      renderTable();
      showNotification(`Category "${oldName}" renamed to "${trimmedNewName}"`);
    }

    // Function to delete a category
    function deleteCategory(nameToDelete) {
      if (nameToDelete === 'All') return; // Safety check
      if (!confirm(`Are you sure you want to permanently delete the category "${nameToDelete}"? It will be removed from all associated links.`)) {
        return;
      }

      // 1. Remove from the categories array
      categories = categories.filter(c => c !== nameToDelete);
      
      // 2. Remove from all links
      links.forEach(link => {
        link.categories = link.categories.filter(c => c !== nameToDelete);
        // Ensure every link retains the 'All' category if others are deleted
        if (link.categories.length === 0) {
            link.categories.push('All');
        }
      });
      
      // 3. Reset filter if the deleted category was active
      if (currentCategoryFilter === nameToDelete) {
        currentCategoryFilter = 'All';
      }

      saveToLocalStorage();
      updateCategoryFilter();
      renderTable();
      showNotification(`Category "${nameToDelete}" deleted.`);
    }

    // CSV Import Logic
    // (handleFileSelect, setupDragAndDrop, importCSV, parseCSV, parseCSVLine remain the same)
    // ... (include all remaining file/import logic here for a complete script)

    function handleFileSelect(files) {
      if (files.length > 0) {
        currentCSVFile = files[0];
        const label = document.getElementById('fileInputLabel');
        label.textContent = `📁 ${currentCSVFile.name}`;
        label.classList.add('has-file');
      }
    }

    function setupDragAndDrop() {
      const dropArea = document.getElementById('fileInputLabel');
      
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
      });
      
      function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
      });
      
      ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
      });
      
      function highlight() {
        dropArea.classList.add('has-file');
      }
      
      function unhighlight() {
        dropArea.classList.remove('has-file');
      }
      
      dropArea.addEventListener('drop', handleDrop, false);
      
      function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFileSelect(files);
      }
    }

    function importCSV() {
      if (!currentCSVFile) {
        showNotification('Please select a CSV file first', true);
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const csvContent = e.target.result;
          const parsedData = parseCSV(csvContent);
          
          if (parsedData.length === 0) {
            showNotification('No valid data found in CSV file', true);
            return;
          }

          let convertedCount = 0;
          let preservedCount = 0;

          const newLinks = parsedData.map(item => {
            const originalLink = item.link;
            const convertedLink = convertGoogleDriveLink(originalLink);
            
            if (originalLink !== convertedLink) {
              convertedCount++;
            } else {
              preservedCount++;
            }

            return {
              name: item.name || 'Untitled',
              link: convertedLink,
              categories: ["All"],
              dateAdded: new Date().toISOString()
            };
          });

          links.unshift(...newLinks);
          saveToLocalStorage();
          renderTable();
          
          // Reset file input
          document.getElementById('csvFile').value = '';
          document.getElementById('fileInputLabel').textContent = '📁 Choose CSV file or drag & drop here';
          document.getElementById('fileInputLabel').classList.remove('has-file');
          currentCSVFile = null;
          
          let summary = `Successfully imported ${newLinks.length} links`;
          if (convertedCount > 0) {
            summary += ` (${convertedCount} converted, ${preservedCount} already direct links)`;
          }
          showNotification(summary);
        } catch (error) {
          showNotification('Error parsing CSV file: ' + error.message, true);
        }
      };
      
      reader.onerror = function() {
        showNotification('Error reading file', true);
      };
      
      reader.readAsText(currentCSVFile);
    }

    function parseCSV(csvText) {
      const lines = csvText.split('\n').filter(line => line.trim());
      if (lines.length < 2) return [];
      
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
      const nameIndex = headers.findIndex(h => h === 'name');
      const linkIndex = headers.findIndex(h => h === 'link' || h === 'url');
      
      if (linkIndex === -1) {
        throw new Error('CSV must contain a "link" or "url" column');
      }
      
      const results = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = parseCSVLine(line);
        
        if (values.length > Math.max(nameIndex, linkIndex)) {
          const name = nameIndex !== -1 ? values[nameIndex].trim() : `Imported Link ${i}`;
          const link = values[linkIndex].trim();
          
          if (link && link.includes('drive.google.com')) {
            results.push({ name, link });
          }
        }
      }
      
      return results;
    }

    function parseCSVLine(line) {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
          // Handle escaped quotes within a quoted field (i.e., double double-quotes)
          if (line[i+1] === '"') {
            current += '"';
            i++;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      
      values.push(current);
      return values.map(v => v.replace(/^"|"$/g, '').trim());
    }

    // Global initialization call
    document.addEventListener('DOMContentLoaded', init);
