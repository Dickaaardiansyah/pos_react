ALTER TABLE stock_opname_items
  ADD UNIQUE KEY uq_so_items_session_product (session_id, product_id);