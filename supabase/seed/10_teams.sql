-- شغّله بعد people_schema.sql
insert into public.teams (id,name,logo,banner,description,sort_order) values
('team_alpha','فريق BLACK ECHO','https://files.catbox.moe/qgtary.jpeg','https://files.catbox.moe/qgtary.jpeg','Black Echo فريق عربي يسعى إلى إعادة تقديم الأنمي بدبلجة عربية احترافية، مع الاهتمام بالجودة، وتطوير المواهب، وصناعة أعمال تليق بالجمهور العربي.',0),
('team_shadow','دوبلاج (اكاتسكي)','https://files.catbox.moe/bijb9i','https://i.ibb.co/nMB9Ddkh/image.png','فريق الأكنسكي هو فريق متخصص في الدوبلاج، يهدف إلى تقديم أعمال صوتية احترافية وخاصة في مجال الأنمي، مع أداء مميز يعكس مشاعر الشخصيات ويقدم تجربة ممتعة للجمهور العربي.',1),
('noor_shadow','دوبلاج (نور شادو)','https://i.ibb.co/99dTkJ6X/image.jpg','https://i.ibb.co/99dTkJ6X/image.jpg','فريق نور شادو هو فريق متخصص في الدوبلاج، يهدف إلى تقديم أعمال صوتية احترافية وخاصة في مجال الأنمي، مع أداء مميز يعكس مشاعر الشخصيات ويقدم تجربة ممتعة للجمهور العربي.',2)
on conflict (id) do nothing;
