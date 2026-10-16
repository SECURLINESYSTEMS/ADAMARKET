-- Seed useful starter fields for each profession so a new company can work
-- immediately, while keeping the schema flexible for future customization.
create or replace function crm_saas_private.seed_industry_custom_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, crm_saas
as $$
declare
  v_fields jsonb;
  v_field jsonb;
begin
  v_fields := jsonb_build_array(
    jsonb_build_object(
      'entity_type', 'customer', 'field_key', 'lead_source',
      'label', 'Источник обращения', 'field_type', 'select',
      'options', jsonb_build_array('Телефон', 'Мессенджер', 'Сайт', 'Рекомендация', 'Другое'),
      'is_required', false
    ),
    jsonb_build_object(
      'entity_type', 'customer', 'field_key', 'preferred_contact',
      'label', 'Предпочтительный способ связи', 'field_type', 'select',
      'options', jsonb_build_array('Телефон', 'Email', 'Мессенджер'),
      'is_required', false
    )
  );

  if new.industry_code = 'service_installation' then
    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object('entity_type','work_item','field_key','service_type','label','Тип услуги','field_type','select','options',jsonb_build_array('Монтаж','Обслуживание','Ремонт','Проверка','Другое'),'is_required',true),
      jsonb_build_object('entity_type','work_item','field_key','service_address','label','Адрес выполнения работ','field_type','text','options','[]'::jsonb,'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','equipment_model','label','Модель оборудования','field_type','text','options','[]'::jsonb,'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','warranty_until','label','Гарантия до','field_type','date','options','[]'::jsonb,'is_required',false)
    );
  elsif new.industry_code = 'beauty' then
    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object('entity_type','work_item','field_key','service_type','label','Услуга','field_type','select','options',jsonb_build_array('Стрижка','Маникюр','Педикюр','Брови','Ресницы','Депиляция','Другое'),'is_required',true),
      jsonb_build_object('entity_type','work_item','field_key','appointment_date','label','Дата записи','field_type','date','options','[]'::jsonb,'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','specialist_name','label','Мастер','field_type','text','options','[]'::jsonb,'is_required',false)
    );
  elsif new.industry_code = 'real_estate' then
    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object('entity_type','work_item','field_key','property_type','label','Тип объекта','field_type','select','options',jsonb_build_array('Квартира','Дом','Коммерческий объект','Земельный участок','Другое'),'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','property_address','label','Адрес объекта','field_type','text','options','[]'::jsonb,'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','area_m2','label','Площадь, м²','field_type','number','options','[]'::jsonb,'is_required',false),
      jsonb_build_object('entity_type','deal','field_key','budget','label','Бюджет клиента','field_type','number','options','[]'::jsonb,'is_required',false)
    );
  elsif new.industry_code = 'education' then
    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object('entity_type','work_item','field_key','course_name','label','Курс или предмет','field_type','text','options','[]'::jsonb,'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','student_level','label','Уровень ученика','field_type','select','options',jsonb_build_array('Начальный','Средний','Продвинутый','Не определён'),'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','lesson_date','label','Дата занятия','field_type','date','options','[]'::jsonb,'is_required',false)
    );
  elsif new.industry_code = 'construction' then
    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object('entity_type','work_item','field_key','project_type','label','Тип проекта','field_type','select','options',jsonb_build_array('Строительство','Ремонт','Отделка','Инженерные сети','Другое'),'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','site_address','label','Адрес объекта','field_type','text','options','[]'::jsonb,'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','estimated_budget','label','Предварительная смета','field_type','number','options','[]'::jsonb,'is_required',false)
    );
  elsif new.industry_code = 'logistics' then
    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object('entity_type','work_item','field_key','origin_address','label','Точка отправления','field_type','text','options','[]'::jsonb,'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','destination_address','label','Точка доставки','field_type','text','options','[]'::jsonb,'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','cargo_weight_kg','label','Вес груза, кг','field_type','number','options','[]'::jsonb,'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','delivery_date','label','Дата доставки','field_type','date','options','[]'::jsonb,'is_required',false)
    );
  elsif new.industry_code = 'retail' then
    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object('entity_type','work_item','field_key','product_sku','label','Артикул товара','field_type','text','options','[]'::jsonb,'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','quantity','label','Количество','field_type','number','options','[]'::jsonb,'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','supplier_name','label','Поставщик','field_type','text','options','[]'::jsonb,'is_required',false)
    );
  elsif new.industry_code = 'general_sales' then
    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object('entity_type','deal','field_key','lead_source','label','Источник сделки','field_type','select','options',jsonb_build_array('Входящий запрос','Холодный контакт','Рекомендация','Повторная продажа','Другое'),'is_required',false),
      jsonb_build_object('entity_type','deal','field_key','next_contact_date','label','Следующий контакт','field_type','date','options','[]'::jsonb,'is_required',false)
    );
  else
    v_fields := v_fields || jsonb_build_array(
      jsonb_build_object('entity_type','work_item','field_key','service_type','label','Тип услуги или проекта','field_type','text','options','[]'::jsonb,'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','next_contact_date','label','Следующий контакт','field_type','date','options','[]'::jsonb,'is_required',false),
      jsonb_build_object('entity_type','work_item','field_key','reference_code','label','Внутренний номер / договор','field_type','text','options','[]'::jsonb,'is_required',false)
    );
  end if;

  for v_field in select value from jsonb_array_elements(v_fields)
  loop
    insert into crm_saas.custom_fields
      (organization_id, entity_type, field_key, label, field_type, options, is_required, is_active, created_by)
    values
      (new.id, v_field->>'entity_type', v_field->>'field_key', v_field->>'label',
       v_field->>'field_type', coalesce(v_field->'options', '[]'::jsonb),
       coalesce((v_field->>'is_required')::boolean, false), true, new.created_by)
    on conflict (organization_id, entity_type, field_key) do nothing;
  end loop;

  return new;
end;
$$;

revoke all on function crm_saas_private.seed_industry_custom_fields() from public, anon, authenticated;

drop trigger if exists organizations_seed_industry_fields on crm_saas.organizations;
create trigger organizations_seed_industry_fields
after insert on crm_saas.organizations
for each row execute function crm_saas_private.seed_industry_custom_fields();
