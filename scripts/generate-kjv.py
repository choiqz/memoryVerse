import json

VERSES = [
# Genesis 1
("Genesis",1,1,"In the beginning God created the heaven and the earth."),
("Genesis",1,2,"And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters."),
("Genesis",1,3,"And God said, Let there be light: and there was light."),
("Genesis",1,4,"And God saw the light, that it was good: and God divided the light from the darkness."),
("Genesis",1,5,"And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day."),
("Genesis",1,26,"And God said, Let us make man in our image, after our likeness: and let them have dominion over the fish of the sea, and over the fowl of the air, and over the cattle, and over all the earth, and over every creeping thing that creepeth upon the earth."),
("Genesis",1,27,"So God created man in his own image, in the image of God created he him; male and female created he them."),
("Genesis",1,28,"And God blessed them, and God said unto them, Be fruitful, and multiply, and replenish the earth, and subdue it: and have dominion over the fish of the sea, and over the fowl of the air, and over every living thing that moveth upon the earth."),
("Genesis",1,31,"And God saw every thing that he had made, and, behold, it was very good. And the evening and the morning were the sixth day."),
# Psalms 1
("Psalms",1,1,"Blessed is the man that walketh not in the counsel of the ungodly, nor standeth in the way of sinners, nor sitteth in the seat of the scornful."),
("Psalms",1,2,"But his delight is in the law of the LORD; and in his law doth he meditate day and night."),
("Psalms",1,3,"And he shall be like a tree planted by the rivers of water, that bringeth forth his fruit in his season; his leaf also shall not wither; and whatsoever he doeth shall prosper."),
("Psalms",1,4,"The ungodly are not so: but are like the chaff which the wind driveth away."),
("Psalms",1,5,"Therefore the ungodly shall not stand in the judgment, nor sinners in the congregation of the righteous."),
("Psalms",1,6,"For the LORD knoweth the way of the righteous: but the way of the ungodly shall perish."),
# Psalms 23
("Psalms",23,1,"The LORD is my shepherd; I shall not want."),
("Psalms",23,2,"He maketh me to lie down in green pastures: he leadeth me beside the still waters."),
("Psalms",23,3,"He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake."),
("Psalms",23,4,"Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me."),
("Psalms",23,5,"Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over."),
("Psalms",23,6,"Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever."),
# Psalms 91
("Psalms",91,1,"He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty."),
("Psalms",91,2,"I will say of the LORD, He is my refuge and my fortress: my God; in him will I trust."),
("Psalms",91,3,"Surely he shall deliver thee from the snare of the fowler, and from the noisome pestilence."),
("Psalms",91,4,"He shall cover thee with his feathers, and under his wings shalt thou trust: his truth shall be thy shield and buckler."),
("Psalms",91,5,"Thou shalt not be afraid for the terror by night; nor for the arrow that flieth by day;"),
("Psalms",91,6,"Nor for the pestilence that walketh in darkness; nor for the destruction that wasteth at noonday."),
("Psalms",91,7,"A thousand shall fall at thy side, and ten thousand at thy right hand; but it shall not come nigh thee."),
("Psalms",91,9,"Because thou hast made the LORD, which is my refuge, even the most High, thy habitation;"),
("Psalms",91,10,"There shall no evil befall thee, neither shall any plague come nigh thy dwelling."),
("Psalms",91,11,"For he shall give his angels charge over thee, to keep thee in all thy ways."),
("Psalms",91,14,"Because he hath set his love upon me, therefore will I deliver him: I will set him on high, because he hath known my name."),
("Psalms",91,15,"He shall call upon me, and I will answer him: I will be with him in trouble; I will deliver him, and honour him."),
("Psalms",91,16,"With long life will I satisfy him, and shew him my salvation."),
# Psalms 121
("Psalms",121,1,"I will lift up mine eyes unto the hills, from whence cometh my help."),
("Psalms",121,2,"My help cometh from the LORD, which made heaven and earth."),
("Psalms",121,3,"He will not suffer thy foot to be moved: he that keepeth thee will not slumber."),
("Psalms",121,4,"Behold, he that keepeth Israel shall neither slumber nor sleep."),
("Psalms",121,5,"The LORD is thy keeper: the LORD is thy shade upon thy right hand."),
("Psalms",121,6,"The sun shall not smite thee by day, nor the moon by night."),
("Psalms",121,7,"The LORD shall preserve thee from all evil: he shall preserve thy soul."),
("Psalms",121,8,"The LORD shall preserve thy going out and thy coming in from this time forth, and even for evermore."),
# Psalms 139
("Psalms",139,1,"O LORD, thou hast searched me, and known me."),
("Psalms",139,2,"Thou knowest my downsitting and mine uprising, thou understandest my thought afar off."),
("Psalms",139,3,"Thou compassest my path and my lying down, and art acquainted with all my ways."),
("Psalms",139,4,"For there is not a word in my tongue, but, lo, O LORD, thou knowest it altogether."),
("Psalms",139,5,"Thou hast beset me behind and before, and laid thine hand upon me."),
("Psalms",139,6,"Such knowledge is too wonderful for me; it is high, I cannot attain unto it."),
("Psalms",139,7,"Whither shall I go from thy spirit? or whither shall I flee from thy presence?"),
("Psalms",139,8,"If I ascend up into heaven, thou art there: if I make my bed in hell, behold, thou art there."),
("Psalms",139,9,"If I take the wings of the morning, and dwell in the uttermost parts of the sea;"),
("Psalms",139,10,"Even there shall thy hand lead me, and thy right hand shall hold me."),
("Psalms",139,13,"For thou hast possessed my reins: thou hast covered me in my mother's womb."),
("Psalms",139,14,"I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well."),
("Psalms",139,23,"Search me, O God, and know my heart: try me, and know my thoughts:"),
("Psalms",139,24,"And see if there be any wicked way in me, and lead me in the way everlasting."),
# Proverbs 3
("Proverbs",3,1,"My son, forget not my law; but let thine heart keep my commandments:"),
("Proverbs",3,2,"For length of days, and long life, and peace, shall they add to thee."),
("Proverbs",3,3,"Let not mercy and truth forsake thee: bind them about thy neck; write them upon the table of thine heart:"),
("Proverbs",3,4,"So shalt thou find favour and good understanding in the sight of God and man."),
("Proverbs",3,5,"Trust in the LORD with all thine heart; and lean not unto thine own understanding."),
("Proverbs",3,6,"In all thy ways acknowledge him, and he shall direct thy paths."),
("Proverbs",3,7,"Be not wise in thine own eyes: fear the LORD, and depart from evil."),
("Proverbs",3,8,"It shall be health to thy navel, and marrow to thy bones."),
("Proverbs",3,9,"Honour the LORD with thy substance, and with the firstfruits of all thine increase:"),
("Proverbs",3,10,"So shall thy barns be filled with plenty, and thy presses shall burst out with new wine."),
# Isaiah 40
("Isaiah",40,1,"Comfort ye, comfort ye my people, saith your God."),
("Isaiah",40,8,"The grass withereth, the flower fadeth: but the word of our God shall stand for ever."),
("Isaiah",40,28,"Hast thou not known? hast thou not heard, that the everlasting God, the LORD, the Creator of the ends of the earth, fainteth not, neither is weary? there is no searching of his understanding."),
("Isaiah",40,29,"He giveth power to the faint; and to them that have no might he increaseth strength."),
("Isaiah",40,30,"Even the youths shall faint and be weary, and the young men shall utterly fall:"),
("Isaiah",40,31,"But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint."),
# Isaiah 53
("Isaiah",53,1,"Who hath believed our report? and to whom is the arm of the LORD revealed?"),
("Isaiah",53,3,"He is despised and rejected of men; a man of sorrows, and acquainted with grief: and we hid as it were our faces from him; he was despised, and we esteemed him not."),
("Isaiah",53,4,"Surely he hath borne our griefs, and carried our sorrows: yet we did esteem him stricken, smitten of God, and afflicted."),
("Isaiah",53,5,"But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed."),
("Isaiah",53,6,"All we like sheep have gone astray; we have turned every one to his own way; and the LORD hath laid on him the iniquity of us all."),
# Matthew 5
("Matthew",5,3,"Blessed are the poor in spirit: for theirs is the kingdom of heaven."),
("Matthew",5,4,"Blessed are they that mourn: for they shall be comforted."),
("Matthew",5,5,"Blessed are the meek: for they shall inherit the earth."),
("Matthew",5,6,"Blessed are they which do hunger and thirst after righteousness: for they shall be filled."),
("Matthew",5,7,"Blessed are the merciful: for they shall obtain mercy."),
("Matthew",5,8,"Blessed are the pure in heart: for they shall see God."),
("Matthew",5,9,"Blessed are the peacemakers: for they shall be called the children of God."),
("Matthew",5,10,"Blessed are they which are persecuted for righteousness sake: for theirs is the kingdom of heaven."),
("Matthew",5,14,"Ye are the light of the world. A city that is set on an hill cannot be hid."),
("Matthew",5,16,"Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven."),
# Matthew 6
("Matthew",6,9,"After this manner therefore pray ye: Our Father which art in heaven, Hallowed be thy name."),
("Matthew",6,10,"Thy kingdom come. Thy will be done in earth, as it is in heaven."),
("Matthew",6,11,"Give us this day our daily bread."),
("Matthew",6,12,"And forgive us our debts, as we forgive our debtors."),
("Matthew",6,13,"And lead us not into temptation, but deliver us from evil: For thine is the kingdom, and the power, and the glory, for ever. Amen."),
("Matthew",6,19,"Lay not up for yourselves treasures upon earth, where moth and rust doth corrupt, and where thieves break through and steal:"),
("Matthew",6,20,"But lay up for yourselves treasures in heaven, where neither moth nor rust doth corrupt, and where thieves do not break through nor steal:"),
("Matthew",6,21,"For where your treasure is, there will your heart be also."),
("Matthew",6,33,"But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you."),
("Matthew",6,34,"Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself. Sufficient unto the day is the evil thereof."),
# John 1
("John",1,1,"In the beginning was the Word, and the Word was with God, and the Word was God."),
("John",1,2,"The same was in the beginning with God."),
("John",1,3,"All things were made by him; and without him was not any thing made that was made."),
("John",1,4,"In him was life; and the life was the light of men."),
("John",1,5,"And the light shineth in darkness; and the darkness comprehended it not."),
("John",1,14,"And the Word was made flesh, and dwelt among us, (and we beheld his glory, the glory as of the only begotten of the Father,) full of grace and truth."),
# John 3
("John",3,16,"For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life."),
("John",3,17,"For God sent not his Son into the world to condemn the world; but that the world through him might be saved."),
("John",3,18,"He that believeth on him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God."),
# John 8
("John",8,31,"Then said Jesus to those Jews which believed on him, If ye continue in my word, then are ye my disciples indeed;"),
("John",8,32,"And ye shall know the truth, and the truth shall make you free."),
# John 10
("John",10,10,"The thief cometh not, but for to steal, and to kill, and to destroy: I am come that they might have life, and that they might have it more abundantly."),
("John",10,11,"I am the good shepherd: the good shepherd giveth his life for the sheep."),
# John 11
("John",11,25,"Jesus said unto her, I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live:"),
("John",11,26,"And whosoever liveth and believeth in me shall never die. Believest thou this?"),
# John 14
("John",14,1,"Let not your heart be troubled: ye believe in God, believe also in me."),
("John",14,2,"In my Father's house are many mansions: if it were not so, I would have told you. I go to prepare a place for you."),
("John",14,3,"And if I go and prepare a place for you, I will come again, and receive you unto myself; that where I am, there ye may be also."),
("John",14,6,"Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me."),
("John",14,27,"Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid."),
# John 15
("John",15,5,"I am the vine, ye are the branches: He that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing."),
("John",15,13,"Greater love hath no man than this, that a man lay down his life for his friends."),
# Romans 3
("Romans",3,23,"For all have sinned, and come short of the glory of God;"),
("Romans",3,24,"Being justified freely by his grace through the redemption that is in Christ Jesus:"),
# Romans 5
("Romans",5,1,"Therefore being justified by faith, we have peace with God through our Lord Jesus Christ:"),
("Romans",5,8,"But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us."),
# Romans 6
("Romans",6,23,"For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord."),
# Romans 8
("Romans",8,1,"There is therefore now no condemnation to them which are in Christ Jesus, who walk not after the flesh, but after the Spirit."),
("Romans",8,28,"And we know that all things work together for good to them that love God, to them who are the called according to his purpose."),
("Romans",8,31,"What shall we then say to these things? If God be for us, who can be against us?"),
("Romans",8,32,"He that spared not his own Son, but delivered him up for us all, how shall he not with him also freely give us all things?"),
("Romans",8,37,"Nay, in all these things we are more than conquerors through him that loved us."),
("Romans",8,38,"For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come,"),
("Romans",8,39,"Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord."),
# Romans 10
("Romans",10,9,"That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved."),
("Romans",10,10,"For with the heart man believeth unto righteousness; and with the mouth confession is made unto salvation."),
("Romans",10,13,"For whosoever shall call upon the name of the Lord shall be saved."),
# Romans 12
("Romans",12,1,"I beseech you therefore, brethren, by the mercies of God, that ye present your bodies a living sacrifice, holy, acceptable unto God, which is your reasonable service."),
("Romans",12,2,"And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God."),
("Romans",12,12,"Rejoicing in hope; patient in tribulation; continuing instant in prayer;"),
("Romans",12,17,"Recompense to no man evil for evil. Provide things honest in the sight of all men."),
("Romans",12,18,"If it be possible, as much as lieth in you, live peaceably with all men."),
# 1 Corinthians 13
("1 Corinthians",13,1,"Though I speak with the tongues of men and of angels, and have not charity, I am become as sounding brass, or a tinkling cymbal."),
("1 Corinthians",13,2,"And though I have the gift of prophecy, and understand all mysteries, and all knowledge; and though I have all faith, so that I could remove mountains, and have not charity, I am nothing."),
("1 Corinthians",13,3,"And though I bestow all my goods to feed the poor, and though I give my body to be burned, and have not charity, it profiteth me nothing."),
("1 Corinthians",13,4,"Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,"),
("1 Corinthians",13,5,"Doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil;"),
("1 Corinthians",13,6,"Rejoiceth not in iniquity, but rejoiceth in the truth;"),
("1 Corinthians",13,7,"Beareth all things, believeth all things, hopeth all things, endureth all things."),
("1 Corinthians",13,8,"Charity never faileth: but whether there be prophecies, they shall fail; whether there be tongues, they shall cease; whether there be knowledge, it shall vanish away."),
("1 Corinthians",13,13,"And now abideth faith, hope, charity, these three; but the greatest of these is charity."),
# Galatians 5
("Galatians",5,22,"But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith,"),
("Galatians",5,23,"Meekness, temperance: against such there is no law."),
# Ephesians 2
("Ephesians",2,8,"For by grace are ye saved through faith; and that not of yourselves: it is the gift of God:"),
("Ephesians",2,9,"Not of works, lest any man should boast."),
("Ephesians",2,10,"For we are his workmanship, created in Christ Jesus unto good works, which God hath before ordained that we should walk in them."),
# Ephesians 6
("Ephesians",6,10,"Finally, my brethren, be strong in the Lord, and in the power of his might."),
("Ephesians",6,11,"Put on the whole armour of God, that ye may be able to stand against the wiles of the devil."),
("Ephesians",6,12,"For we wrestle not against flesh and blood, but against principalities, against powers, against the rulers of the darkness of this world, against spiritual wickedness in high places."),
("Ephesians",6,13,"Wherefore take unto you the whole armour of God, that ye may be able to withstand in the evil day, and having done all, to stand."),
# Philippians 1
("Philippians",1,6,"Being confident of this very thing, that he which hath begun a good work in you will perform it until the day of Jesus Christ:"),
("Philippians",1,21,"For to me to live is Christ, and to die is gain."),
# Philippians 2
("Philippians",2,3,"Let nothing be done through strife or vainglory; but in lowliness of mind let each esteem other better than themselves."),
("Philippians",2,4,"Look not every man on his own things, but every man also on the things of others."),
("Philippians",2,5,"Let this mind be in you, which was also in Christ Jesus:"),
# Philippians 3
("Philippians",3,13,"Brethren, I count not myself to have apprehended: but this one thing I do, forgetting those things which are behind, and reaching forth unto those things which are before,"),
("Philippians",3,14,"I press toward the mark for the prize of the high calling of God in Christ Jesus."),
# Philippians 4
("Philippians",4,4,"Rejoice in the Lord alway: and again I say, Rejoice."),
("Philippians",4,5,"Let your moderation be known unto all men. The Lord is at hand."),
("Philippians",4,6,"Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God."),
("Philippians",4,7,"And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus."),
("Philippians",4,8,"Finally, brethren, whatsoever things are true, whatsoever things are honest, whatsoever things are just, whatsoever things are pure, whatsoever things are lovely, whatsoever things are of good report; if there be any virtue, and if there be any praise, think on these things."),
("Philippians",4,11,"Not that I speak in respect of want: for I have learned, in whatsoever state I am, therewith to be content."),
("Philippians",4,13,"I can do all things through Christ which strengtheneth me."),
("Philippians",4,19,"But my God shall supply all your need according to his riches in glory by Christ Jesus."),
# Colossians 3
("Colossians",3,2,"Set your affection on things above, not on things on the earth."),
("Colossians",3,23,"And whatsoever ye do, do it heartily, as to the Lord, and not unto men;"),
# 2 Timothy 3
("2 Timothy",3,16,"All scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness:"),
("2 Timothy",3,17,"That the man of God may be perfect, throughly furnished unto all good works."),
# Hebrews 11
("Hebrews",11,1,"Now faith is the substance of things hoped for, the evidence of things not seen."),
("Hebrews",11,6,"But without faith it is impossible to please him: for he that cometh to God must believe that he is, and that he is a rewarder of them that diligently seek him."),
# James 1
("James",1,5,"If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him."),
("James",1,17,"Every good gift and every perfect gift is from above, and cometh down from the Father of lights, with whom is no variableness, neither shadow of turning."),
# 1 Peter 5
("1 Peter",5,7,"Casting all your care upon him; for he careth for you."),
# 1 John 1
("1 John",1,9,"If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness."),
# 1 John 4
("1 John",4,7,"Beloved, let us love one another: for love is of God; and every one that loveth is born of God, and knoweth God."),
("1 John",4,8,"He that loveth not knoweth not God; for God is love."),
("1 John",4,19,"We love him, because he first loved us."),
]

output = [{"book": b, "chapter": c, "verse": v, "text": t} for (b,c,v,t) in VERSES]

import os
os.makedirs(os.path.join("assets", "bible"), exist_ok=True)

with open(os.path.join("assets", "bible", "kjv.json"), "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"Written {len(output)} verses to kjv.json")
